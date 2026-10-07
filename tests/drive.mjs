// Losse proef: stappen uit een JSON-bestand uitvoeren in headless Chrome en screenshots maken (voor de echte tests: tests/run.mjs).
// Gebruik: node tests/drive.mjs <stappen.json> <uitvoermap>   (testserver: python3 scripts/serve.py)
// Stap: { goto } | { eval, print } | { key, repeat, hold } | { wait } | { shot } | { viewport: [w, h] }
import fs from 'node:fs';
import path from 'node:path';
import { Browser, sleep } from './lib/browser.mjs';

const steps = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = process.argv[3];
fs.mkdirSync(outDir, { recursive: true });

const b = new Browser();
await b.start();
for (const s of steps) {
  if (s.goto) { await b.goto(s.goto); await sleep(500); }
  if (s.eval) {
    const v = await b.eval(s.eval).catch(e => e.message);
    if (s.print) console.log('EVAL', JSON.stringify(v));
  }
  if (s.key) for (let i = 0; i < (s.repeat || 1); i++) await b.key(s.key, s.hold);
  if (s.viewport) await b.viewport(s.viewport[0], s.viewport[1]);
  if (s.wait) await sleep(s.wait);
  if (s.shot) await b.shot(path.join(outDir, s.shot));
}
if (b.logs.length) console.log(b.logs.slice(0, 40).map(l => l.type + ': ' + l.text).join('\n'));
await b.close();
process.exit(0);
