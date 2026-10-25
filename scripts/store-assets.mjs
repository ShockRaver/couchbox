#!/usr/bin/env node
// Winkelafbeeldingen voor Samsung (1920×1080): logo (PNG, 32-bit met transparantie) en achtergrond (JPG).
// Getekend met het logo uit de app (Icons.logo) en de kleuren uit DESIGN.md. Geen tekst of beelden van derden.
// Gebruik: node scripts/store-assets.mjs   → store/logo.png, store/background.jpg
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep } from '../tests/lib/browser.mjs';
import { serve } from '../tests/lib/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'store');

// Pagina vervangen door één ontwerp (de app is geladen, zodat Icons.logo() en het lettertype beschikbaar zijn)
const page = (css, html) => `(function () {
  document.head.querySelectorAll('style,link[rel=stylesheet]').forEach(function (e) { e.remove(); });
  var st = document.createElement('style');
  st.textContent = ${JSON.stringify('html,body{margin:0;width:1920px;height:1080px;overflow:hidden;font-family:"SamsungOne","Samsung Sans","Helvetica Neue",Arial,sans-serif;}' + css)};
  document.head.appendChild(st);
  document.body.className = '';
  document.body.innerHTML = ${JSON.stringify(html)}.replace(/LOGO/g, Icons.logo());
  return 1;
})()`;

// Logo: doosje met ogen en de naam, op een transparante achtergrond
const LOGO_CSS = `html,body{background:transparent!important}
  .wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:56px}
  .wrap svg{width:520px;height:455px;filter:drop-shadow(0 18px 40px rgba(0,0,0,.35))}
  .name{font-size:210px;font-weight:700;letter-spacing:-4px;color:#fff;text-shadow:0 10px 36px rgba(0,0,0,.45)}`;
const LOGO_HTML = '<div class="wrap">LOGO<div class="name">Couchbox</div></div>';

// Achtergrond: donker zoals de app, warme gloed in de merkkleur, vage rijen kaarten (zoals de app eruitziet), geen tekst
const tiles = (top, n, w, h, op) => Array.from({ length: n }, (_, i) =>
  `<div class="t" style="left:${120 + i * (w + 28)}px;top:${top}px;width:${w}px;height:${h}px;opacity:${op}"></div>`).join('');
const BG_CSS = `html,body{background:#08090b!important}
  .glow{position:absolute;inset:0;background:radial-gradient(1100px 760px at 78% 18%,rgba(242,169,59,.30),transparent 62%),
    radial-gradient(900px 700px at 12% 100%,rgba(242,169,59,.10),transparent 60%),linear-gradient(180deg,#0c0d10,#08090b)}
  .t{position:absolute;border-radius:18px;background:linear-gradient(160deg,#23252b,#16171b);box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)}
  .fade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,9,11,.85) 0%,rgba(8,9,11,.2) 45%,rgba(8,9,11,0) 70%)}
  .mark{position:absolute;right:150px;top:190px;opacity:.95}
  .mark svg{width:430px;height:376px;filter:drop-shadow(0 30px 60px rgba(0,0,0,.55))}`;
const BG_HTML = '<div class="glow"></div>' + tiles(640, 9, 184, 270, 0.55) + tiles(950, 6, 300, 200, 0.35) +
  '<div class="fade"></div><div class="mark">LOGO</div>';

const srv = await serve(root, { '/js/config.local.js': '' });
const b = new Browser();
await b.start();
try {
  await b.goto(srv.url + '/index.html');
  await sleep(800);
  await b.eval(page(LOGO_CSS, LOGO_HTML)); await sleep(300);
  await b.shot(path.join(out, 'logo.png'), { transparent: true });
  await b.eval(page(BG_CSS, BG_HTML)); await sleep(300);
  await b.shot(path.join(out, 'background.jpg'));
  console.log('store/logo.png, store/background.jpg');
} finally {
  await b.close();
  await srv.close();
}
