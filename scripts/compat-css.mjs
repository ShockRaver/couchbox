// Maakt uit css/app.css de stylesheets voor oudere Samsung-TV's (Tizen 3.0–6.0, Chromium 47–76). Niets met de hand bijhouden:
// na een wijziging in app.css dit script draaien (de tests controleren of de bestanden actueel zijn).
//   css/compat.css      Altijd geladen; regels gelden alleen met een klasse op <html> die js/compat.js zet:
//                       .no-flexgap (flexbox kent geen gap: Chromium < 84) en .no-grid (geen CSS-grid: Chromium < 57)
//   css/app.legacy.css  app.css met var(--…) ingevuld en -webkit-voorvoegsels, voor TV's zonder CSS-variabelen (Chromium < 49)
// Gebruik: node scripts/compat-css.mjs          (schrijven)
//          node scripts/compat-css.mjs --check  (alleen controleren; afwijking = exit 1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');

// ---- CSS in regels opdelen: [{ sel, decls: [[prop, value]], media }] (geneste @media; @keyframes overgeslagen) ----
function parse(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  (function block(text, media) {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const body = text.slice(open + 1, j - 1);
      if (head.startsWith('@media')) block(body, head);
      else if (!head.startsWith('@')) {
        const decls = body.split(';').map(d => d.trim()).filter(Boolean).map(d => { const k = d.indexOf(':'); return [d.slice(0, k).trim(), d.slice(k + 1).trim()]; });
        rules.push({ sel: head, decls, media });
      }
      i = j;
    }
  })(css, null);
  return rules;
}

// ---- var(--x) invullen met de waarden uit :root ----
const rules = parse(src);
const vars = {};
rules.filter(r => r.sel === ':root').forEach(r => r.decls.forEach(([k, v]) => { if (k.startsWith('--')) vars[k] = v; }));
function resolve(v) {
  for (let n = 0; n < 5 && /var\(/.test(v); n++) {
    v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (m, name, fb) => {
      if (!(name in vars) && fb == null) throw new Error('Onbekende CSS-variabele ' + name);
      return name in vars ? vars[name] : fb.trim();
    });
  }
  return v;
}

const head = '/* GEGENEREERD door scripts/compat-css.mjs uit css/app.css – niet met de hand aanpassen */\n';
const wrap = (media, text) => media ? `${media} {\n${text}\n}\n` : text + '\n';
const prefix = (cls, sel) => sel.split(',').map(s => `html.${cls} ${s.trim()}`).join(', ');

// ---- compat.css ----
// Per selector alle eigenschappen samen (bv. display en flex-direction in de ene regel, gap in een latere)
const props = {};
rules.forEach(r => { const p = props[r.sel] = props[r.sel] || {}; r.decls.forEach(([k, v]) => { p[k] = v; }); });
let compat = head + '/* Oudere TV\'s: flexbox zonder gap (Chromium < 84) en geen CSS-grid (Chromium < 57). Zie js/compat.js. */\n';
const autos = [];
rules.forEach(r => {
  const gapDecl = r.decls.find(([k]) => k === 'gap');
  const all = props[r.sel];
  if (gapDecl) {
    const g = resolve(gapDecl[1]).split(/\s+/), row = g[0], col = g[1] || g[0];
    let css;
    if (all.display === 'grid') css = `${prefix('no-flexgap', r.sel)} { grid-gap: ${row} ${col}; }`;   // Chromium 57–65: alleen grid-gap
    else if (/wrap/.test(all['flex-wrap'] || '')) {
      // Doorlopende rijen (bv. jaar · duur · genre) bevatten ook losse tekst, waar marges niet op werken:
      // daarom de ruimte half links en half rechts van elk element, en de rij zelf een halve gap naar links
      const half = (parseFloat(col) / 2) + 'px';
      css = `${prefix('no-flexgap', r.sel)} { margin-left: -${half}; }\n` +
        `${r.sel.split(',').map(s => `html.no-flexgap ${s.trim()} > *`).join(', ')} { margin-left: ${half}; margin-right: ${half}; margin-bottom: ${row}; }`;
    }
    else {
      const column = /column/.test(all['flex-direction'] || '');
      css = `${r.sel.split(',').map(s => `html.no-flexgap ${s.trim()} > * + *`).join(', ')} { ${column ? 'margin-top' : 'margin-left'}: ${column ? row : col}; }`;
    }
    compat += wrap(r.media, css);
  }
  // Automatische marges (bv. margin-left: auto om iets naar rechts te duwen) mogen niet door de gap-vervanging verdwijnen
  r.decls.filter(([k, v]) => /^margin(-left|-top)?$/.test(k) && /\bauto\b/.test(v)).forEach(([k, v]) => autos.push(wrap(r.media, `${prefix('no-flexgap', r.sel)} { ${k}: ${resolve(v)}; }`)));
});
compat += '/* Automatische marges terugzetten */\n' + autos.join('');
// Vaste uitzonderingen: de cursor in het zoekveld staat bij een lege zoekregel met order: -1 helemaal vooraan (vóór het icoon)
// (de gap-vervanging rekent met de volgorde in de HTML, niet met de getoonde volgorde)
compat += `/* Zoekveld: cursor na de tekst, of (lege zoekregel) vooraan, 10px vóór het icoon */
html.no-flexgap .sk-query > .sk-caret { margin-left: 6px; }
html.no-flexgap .sk-query > .sk-text.empty + .sk-caret { margin-left: 0; margin-right: 10px; }
`;
// Toetsenbord (grid met 6 kolommen) als flexbox met marges
const keys = props['.sk-keys'] || {}, cols = (keys['grid-template-columns'] || '').match(/repeat\((\d+),\s*(\d+)px\)/);
if (!cols) throw new Error('.sk-keys: grid-template-columns niet gevonden');
const n = +cols[1], w = +cols[2], kg = parseInt(resolve(keys.gap || '0'), 10);
compat += `/* Zoektoetsenbord zonder CSS-grid: ${n} kolommen van ${w}px */
html.no-grid .sk-keys { display: flex; flex-wrap: wrap; width: ${n * w + n * kg}px; margin-right: -${kg}px; }
html.no-grid .sk-keys > * { width: ${w}px; margin: 0 ${kg}px ${kg}px 0; }
html.no-grid .sk-keys > .wide { width: ${2 * w + kg}px; }
`;

// ---- app.legacy.css ----
let legacy = head + '/* Voor TV\'s zonder CSS-variabelen (Chromium < 49, Tizen 3.0): app.css met ingevulde waarden. Zie js/compat.js. */\n';
legacy += src.replace(/^\/\*[\s\S]*?\*\/\s*/, '')
  .replace(/:root\s*\{[^}]*\}\s*/, '')
  .replace(/var\(\s*--[\w-]+\s*(?:,\s*[^()]*)?\)/g, m => resolve(m))
  .replace(/(^|[;{\s])user-select:\s*([^;}]+)/g, '$1-webkit-user-select: $2; user-select: $2')
  .replace(/(^|[;{\s])filter:\s*([^;}]+)/g, '$1-webkit-filter: $2; filter: $2');
if (/var\(--/.test(legacy)) throw new Error('Niet alle CSS-variabelen ingevuld');

const outFiles = { 'css/compat.css': compat, 'css/app.legacy.css': legacy };
if (process.argv.includes('--check')) {
  const stale = Object.keys(outFiles).filter(f => !fs.existsSync(path.join(root, f)) || fs.readFileSync(path.join(root, f), 'utf8') !== outFiles[f]);
  if (stale.length) { console.log('Niet actueel: ' + stale.join(', ') + ' (draai node scripts/compat-css.mjs)'); process.exit(1); }
  console.log('Compat-CSS actueel');
} else {
  Object.keys(outFiles).forEach(f => fs.writeFileSync(path.join(root, f), outFiles[f]));
  console.log('Geschreven: ' + Object.keys(outFiles).join(', '));
}
