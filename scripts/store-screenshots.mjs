#!/usr/bin/env node
// Screenshots voor de Samsung-winkel (1920×1080, JPG): demo-modus, zonder TMDB (dus geen posters of beelden van echte films),
// zodat er niets van derden in beeld is. Gebruik: node scripts/store-screenshots.mjs [taal]   → store/screenshots/<taal>-*.jpg
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep } from '../tests/lib/browser.mjs';
import { serve } from '../tests/lib/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lang = process.argv[2] || 'en';
const out = path.join(root, 'store/screenshots');
fs.mkdirSync(out, { recursive: true });

// Leeg config.local.js: geen TMDB-sleutel, dus geen beelden of teksten van echte films
const srv = await serve(root, { '/js/config.local.js': '// geen sleutel voor screenshots\n' });
const b = new Browser();
await b.start();
try {
  await b.goto(srv.url + '/index.html');
  await sleep(800);
  const noTmdb = "Store.setSetting('tmdbKey', '');";
  if (await b.eval('Tmdb.enabled()')) throw new Error('TMDB staat nog aan');
  await b.eval(noTmdb + fs.readFileSync(path.join(root, 'tests/setup-demo.js'), 'utf8'));
  await b.eval(`Store.setSetting('lang', '${lang}'); location.reload(); 1`);
  await sleep(2500);
  if (await b.eval('Tmdb.enabled() || Meta.count() > 0')) throw new Error('TMDB-gegevens in beeld');
  const shot = async (name, js, wait = 1500) => { await b.eval(js + '; 1'); await sleep(wait); await b.shot(path.join(out, `${lang}-${name}.jpg`)); console.log(`${lang}-${name}.jpg`); };
  await shot('1-home', "App.section('home')");
  await shot('2-live', "App.section('live'); setTimeout(function () { Screens.live.applyLineup('all'); }, 300)", 2500);
  await shot('3-guide', "App.section('guide'); setTimeout(function () { var g = Screens.guide.groups.filter(function (x) { return x.id === 'all'; })[0]; if (g) Screens.guide.useGroup(g); }, 600)", 3000);
  await shot('4-movies', "App.section('movie')", 2500);
  await shot('5-search', "App.section('search'); setTimeout(function () { 'demo'.split('').forEach(function (c) { Screens.search.press(c); }); }, 300)", 2500);
  await shot('6-settings', "App.section('settings')");
} finally {
  await b.close();
  await srv.close();
}
