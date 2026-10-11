#!/usr/bin/env node
// Alle tests: eerst snelle controles (syntax, vertalingen), daarna schermtests in headless Chrome met de demo-server.
// Gebruik: node tests/run.mjs [filter]      filter = stukje van de naam van een test of testbestand
// Uitvoer: build/test-out/run (screenshots bij fouten, results.json); op GitHub ook een samenvatting bij de run.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Browser, sleep } from './lib/browser.mjs';
import { serve } from './lib/server.mjs';
import { m3uFixtures } from './fixtures/m3u.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'build/test-out/run');
const filter = (process.argv[2] || '').toLowerCase();
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const results = [];
const C = process.stdout.isTTY ? { ok: '\x1b[32m', fail: '\x1b[31m', skip: '\x1b[33m', dim: '\x1b[2m', end: '\x1b[0m' } : { ok: '', fail: '', skip: '', dim: '', end: '' };
function report(r) {
  results.push(r);
  const mark = r.status === 'ok' ? C.ok + '✓' : r.status === 'skip' ? C.skip + '–' : C.fail + '✗';
  console.log(`  ${mark} ${r.name}${C.end} ${C.dim}${r.ms != null ? r.ms + ' ms' : ''}${r.status === 'skip' ? ' (' + r.reason + ')' : ''}${C.end}`);
  if (r.status === 'fail') console.log('    ' + r.error.split('\n').join('\n    '));
}

// ---------- 1. Snelle controles ----------
function staticChecks() {
  console.log('\nControles');
  const files = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(path.join(root, dir))) {
      const p = dir + '/' + f;
      if (fs.statSync(path.join(root, p)).isDirectory()) walk(p); else if (/\.(js|mjs)$/.test(f)) files.push(p);
    }
  })('js');
  ['tests', 'scripts'].forEach(d => fs.readdirSync(path.join(root, d)).filter(f => /\.(js|mjs)$/.test(f)).forEach(f => files.push(d + '/' + f)));
  const bad = files.filter(f => spawnSync(process.execPath, ['--check', f], { cwd: root }).status !== 0);
  report(bad.length ? { name: `Syntax van ${files.length} bestanden`, status: 'fail', error: 'Fout in: ' + bad.join(', ') } : { name: `Syntax van ${files.length} bestanden`, status: 'ok' });

  // Elke script-tag in index.html moet naar een bestaand bestand wijzen (behalve config.local.js, die niet in git staat)
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const missing = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1])// $WEBAPIS bestaat alleen op de TV
    .filter(f => f !== 'js/config.local.js' && !f.startsWith('$') && !fs.existsSync(path.join(root, f)));
  report(missing.length ? { name: 'Scripts in index.html bestaan', status: 'fail', error: 'Ontbreekt: ' + missing.join(', ') } : { name: 'Scripts in index.html bestaan', status: 'ok' });

  // Samsung-keuring: geen alert(), confirm() of prompt() in de app (ook niet als eigen functienaam; hun controle zoekt op tekst)
  const banned = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(path.join(root, dir))) {
      const p = dir + '/' + f;
      if (fs.statSync(path.join(root, p)).isDirectory()) { if (f !== 'lang') walk(p); continue; }
      if (!/\.js$/.test(f)) continue;
      fs.readFileSync(path.join(root, p), 'utf8').split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        if (/\b(alert|confirm|prompt)\s*\(/.test(code)) banned.push(`${p}:${i + 1}: ${line.trim().slice(0, 80)}`);
      });
    }
  })('js');
  report(banned.length ? { name: 'Geen alert/confirm/prompt (Samsung-keuring)', status: 'fail', error: banned.join('\n') } : { name: 'Geen alert/confirm/prompt (Samsung-keuring)', status: 'ok' });

  const i18n = spawnSync(process.execPath, ['scripts/i18n-check.js'], { cwd: root, encoding: 'utf8' });
  const miss = (i18n.stdout.match(/Zonder Engelse vertaling \((\d+)\)/) || [])[1];
  report(i18n.status === 0 ? { name: 'Vertalingen compleet (i18n-check)', status: 'ok' }
    : { name: 'Vertalingen compleet (i18n-check)', status: 'fail', error: `${miss || '?'} teksten zonder Engelse vertaling:\n` + i18n.stdout.split('Zonder Engelse vertaling')[1]?.split('\n\n')[0] });
}

// ---------- 2. Schermtests ----------
class Skip extends Error {}
const hasTmdb = (() => {
  const f = path.join(root, 'js/config.local.js');
  return fs.existsSync(f) && /tmdbKey\s*=\s*['"][0-9a-f]{32}['"]/i.test(fs.readFileSync(f, 'utf8'));
})();
const setupDemo = fs.readFileSync(path.join(root, 'tests/setup-demo.js'), 'utf8');

function context(b, base, name) {
  const t = {
    base, hasTmdb, b,
    // App openen als nieuwe installatie (alle opgeslagen gegevens gewist)
    async open(o = {}) {
      if (o.fresh !== false) { await b.goto('about:blank'); await b.clearOrigin(base); }
      await b.goto(base + '/index.html' + (o.query || ''));
      await t.until('window.App && App.stack && App.stack.length > 0', 10000, 'app start niet');
    },
    // Demo-profiel met kijkgeschiedenis, Mijn lijst en favoriete zender; daarna op Home
    async demo(o = {}) {
      await t.open(o);
      t.eq(await b.eval(setupDemo), 'ok', 'demo-profiel klaarzetten');
      await t.until("App.screen() === Screens.home && Screens.home.rows.rows.length > 0", 10000, 'Home toont geen rijen');
    },
    eval: expr => b.eval(expr),
    async until(expr, ms = 8000, msg) {
      const end = Date.now() + ms;
      let v;
      while (Date.now() < end) { v = await b.eval(expr).catch(e => { throw e; }); if (v) return v; await sleep(100); }
      throw new Error((msg ? msg + ': ' : '') + `na ${ms} ms nog niet waar: ${expr}`);
    },
    async key(k, n = 1, hold) { for (let i = 0; i < n; i++) await b.key(k, hold); },
    async type(text) { for (const ch of text) await b.key(ch === ' ' ? ' ' : ch); },
    wait: ms => sleep(ms),
    screen: () => b.eval('App.stack[App.stack.length - 1].name'),
    shot: file => b.shot(path.join(out, file)),
    ok(c, msg) { if (!c) throw new Error(msg || 'verwachting klopt niet'); },
    eq(a, x, msg) { if (JSON.stringify(a) !== JSON.stringify(x)) throw new Error(`${msg || 'waarde'}: verwacht ${JSON.stringify(x)}, kreeg ${JSON.stringify(a)}`); },
    skip(reason) { throw new Skip(reason); }
  };
  return t;
}

async function browserTests() {
  const specs = fs.readdirSync(path.join(root, 'tests/specs')).filter(f => f.endsWith('.mjs')).sort();
  const srv = await serve(root, m3uFixtures());
  const b = new Browser();
  await b.start();
  try {
    for (const file of specs) {
      const tests = (await import(pathToFileURL(path.join(root, 'tests/specs', file)))).default;
      const todo = tests.filter(x => !filter || (file + ' ' + x.name).toLowerCase().includes(filter));
      if (!todo.length) continue;
      console.log('\n' + file.replace(/^\d+-|\.mjs$/g, ''));
      for (const test of todo) {
        const name = test.name, t0 = Date.now();
        if (test.tmdb && !hasTmdb) { report({ name, status: 'skip', reason: 'geen TMDB-sleutel' }); continue; }
        b.logs = [];
        try {
          const t = context(b, srv.url, name);
          let timer;
          await Promise.race([test.run(t), new Promise((_, j) => { timer = setTimeout(() => j(new Error(`duurt langer dan ${(test.timeout || 45000) / 1000} s`)), test.timeout || 45000); })]);
          clearTimeout(timer);
          // Fouten in de console tellen ook als mislukt (tenzij de test ze verwacht)
          const errs = b.logs.filter(l => l.type !== 'warning' && !(test.allow && test.allow.test(l.text)));
          if (errs.length) throw new Error('Fouten in de console:\n' + errs.map(l => l.text).join('\n'));
          report({ name, status: 'ok', ms: Date.now() - t0 });
        } catch (e) {
          if (e instanceof Skip) { report({ name, status: 'skip', reason: e.message }); continue; }
          const shot = name.replace(/[^\w-]+/g, '_').slice(0, 60) + '.png';
          await b.shot(path.join(out, shot)).catch(() => {});
          report({ name, status: 'fail', ms: Date.now() - t0, error: e.message, shot });
        }
      }
    }
  } finally {
    await b.close();
    await srv.close();
  }
}

staticChecks();
await browserTests();

// ---------- Samenvatting ----------
const n = s => results.filter(r => r.status === s).length;
console.log(`\n${n('ok')} geslaagd, ${n('fail')} mislukt, ${n('skip')} overgeslagen`);
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  const icon = { ok: '✅', fail: '❌', skip: '⏭️' };
  const md = [`### Tests: ${n('ok')} geslaagd, ${n('fail')} mislukt, ${n('skip')} overgeslagen`, '', '| | Test | Tijd |', '|---|---|---|',
    ...results.map(r => `| ${icon[r.status]} | ${r.name}${r.status === 'fail' ? '<br><sub>' + r.error.replace(/\n/g, '<br>').replace(/\|/g, '\\|').slice(0, 500) + '</sub>' : ''}${r.status === 'skip' ? ' <sub>(' + r.reason + ')</sub>' : ''} | ${r.ms != null ? r.ms + ' ms' : ''} |`)];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n') + '\n');
}
process.exit(n('fail') ? 1 : 0);
