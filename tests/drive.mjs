// Headless Chrome aansturen via CDP: stappen uit een JSON-bestand uitvoeren en screenshots maken.
// Gebruik: node tests/drive.mjs <stappen.json> <uitvoermap>   (testserver: python3 scripts/serve.py)
// Stap: { goto } | { eval, print } | { key, repeat, hold } | { wait } | { shot } | { viewport: [w, h] }
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const steps = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = process.argv[3];
fs.mkdirSync(outDir, { recursive: true });
const port = 9333;
const profile = path.join(outDir, 'chrome-profile');

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=1920,1080', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const logs = [];
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
    } catch (e) { /* Chrome start nog */ }
    await sleep(200);
  }
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type !== 'log') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  });
}
function send(method, params = {}) {
  return new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
}
const KEYS = { up: ['ArrowUp', 38], down: ['ArrowDown', 40], left: ['ArrowLeft', 37], right: ['ArrowRight', 39], ok: ['Enter', 13], back: ['Escape', 27],
  red: ['F1', 112], green: ['F2', 113], pgup: ['PageUp', 33], pgdn: ['PageDown', 34] };
async function key(name, holdMs) {
  const [k, code] = KEYS[name] || [name, name.toUpperCase().charCodeAt(0)];
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
  if (holdMs) await sleep(holdMs);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
  await sleep(60);
}

await connect();
await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
for (const s of steps) {
  if (s.goto) { await send('Page.navigate', { url: s.goto }); await sleep(1200); }
  if (s.eval) {
    const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true });
    if (s.print) console.log('EVAL', JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? r.result));
  }
  if (s.key) for (let i = 0; i < (s.repeat || 1); i++) await key(s.key, s.hold);
  if (s.viewport) await send('Emulation.setDeviceMetricsOverride', { width: s.viewport[0], height: s.viewport[1], deviceScaleFactor: 1, mobile: false });
  if (s.wait) await sleep(s.wait);
  if (s.shot) {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, s.shot), Buffer.from(r.result.data, 'base64'));
  }
}
if (logs.length) console.log(logs.slice(0, 40).join('\n'));
// Netjes afsluiten, zodat localStorage bewaard blijft
await send('Page.navigate', { url: 'about:blank' }); await sleep(300);
await send('Browser.close').catch(() => {});
setTimeout(() => { chrome.kill(); process.exit(0); }, 500);
