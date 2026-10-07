// Headless Chrome via het DevTools-protocol (CDP), zonder extra pakketten.
// Werkt op macOS (Google Chrome) en Linux/GitHub Actions (google-chrome of chromium); pad te kiezen met CHROME=…
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

function findChrome() {
  const list = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const hit = list.find(p => p && fs.existsSync(p));
  if (!hit) throw new Error('Chrome niet gevonden; zet CHROME=/pad/naar/chrome');
  return hit;
}

// Afstandsbedieningstoetsen zoals de app ze in de browser verwacht
const KEYS = { up: ['ArrowUp', 38], down: ['ArrowDown', 40], left: ['ArrowLeft', 37], right: ['ArrowRight', 39], ok: ['Enter', 13], back: ['Escape', 27],
  red: ['F1', 112], green: ['F2', 113], yellow: ['F3', 114], blue: ['F4', 115], pgup: ['PageUp', 33], pgdn: ['PageDown', 34], backspace: ['Backspace', 8] };

export class Browser {
  constructor() { this.id = 0; this.pending = new Map(); this.logs = []; }

  async start() {
    this.profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kijkdoos-chrome-'));
    const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${this.profile}`, '--window-size=1920,1080',
      '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--no-first-run', '--no-default-browser-check'];
    // Op GitHub (Ubuntu 24.04) staat de Chrome-sandbox voor gewone gebruikers uit
    if (process.env.CI) args.push('--no-sandbox', '--disable-dev-shm-usage');
    this.chrome = spawn(findChrome(), [...args, 'about:blank'], { stdio: 'ignore' });
    // Chrome schrijft de gekozen poort in DevToolsActivePort
    const portFile = path.join(this.profile, 'DevToolsActivePort');
    let port;
    for (let i = 0; i < 100 && !port; i++) {
      if (fs.existsSync(portFile)) port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
      if (!port) await sleep(100);
    }
    if (!port) throw new Error('Chrome start niet');
    let page;
    for (let i = 0; i < 50 && !page; i++) {
      try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch (e) { /* nog niet klaar */ }
      if (!page) await sleep(100);
    }
    this.ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, j) => { this.ws.addEventListener('open', r); this.ws.addEventListener('error', j); });
    this.ws.addEventListener('message', ev => this.onMessage(JSON.parse(ev.data)));
    await this.send('Runtime.enable'); await this.send('Page.enable'); await this.send('Network.enable');
    await this.send('Network.setCacheDisabled', { cacheDisabled: true });
    await this.viewport(1920, 1080);
  }

  onMessage(m) {
    if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning'))
      this.logs.push({ type: m.params.type, text: m.params.args.map(a => a.value ?? a.description).join(' ') });
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      this.logs.push({ type: 'exception', text: (d.exception?.description || d.text) + (d.url ? ` (${d.url.split('/').pop()}:${d.lineNumber + 1})` : '') });
    }
  }

  send(method, params = {}) {
    return new Promise(r => { const i = ++this.id; this.pending.set(i, r); this.ws.send(JSON.stringify({ id: i, method, params })); });
  }

  viewport(w, h) { return this.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); }

  async goto(url) {
    const loaded = new Promise(r => { const f = ev => { if (JSON.parse(ev.data).method === 'Page.loadEventFired') { this.ws.removeEventListener('message', f); r(); } }; this.ws.addEventListener('message', f); });
    await this.send('Page.navigate', { url });
    await Promise.race([loaded, sleep(10000)]);
  }

  // Alle opgeslagen gegevens van de app wissen (localStorage én IndexedDB), zoals een nieuwe installatie
  clearOrigin(origin) { return this.send('Storage.clearDataForOrigin', { origin, storageTypes: 'all' }); }

  // Expressie uitvoeren in de pagina; gooit een fout als er een uitzondering optreedt
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error('In de pagina: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
    return r.result?.result?.value;
  }

  async key(name, holdMs) {
    const [k, code] = KEYS[name] || [name, name.toUpperCase().charCodeAt(0)];
    await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
    if (holdMs) await sleep(holdMs);
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
    await sleep(60);
  }

  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  }

  async close() {
    // Eerst wegnavigeren, zodat localStorage netjes wordt weggeschreven
    try { await this.send('Page.navigate', { url: 'about:blank' }); await sleep(200); await this.send('Browser.close'); } catch (e) { /* al dicht */ }
    await sleep(300);
    try { this.chrome.kill(); } catch (e) { /* al gestopt */ }
    try { fs.rmSync(this.profile, { recursive: true, force: true }); } catch (e) { /* laat maar staan */ }
  }
}
