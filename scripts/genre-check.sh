#!/usr/bin/env bash
# Controleert de genre-indeling op je echte catalogus: aantallen per genre en welke series als Horror worden herkend.
# Gebruikt dezelfde regels als de app (js/genres.js). Je wachtwoord wordt verborgen ingevoerd en nergens opgeslagen.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/build/genre-check.txt"
mkdir -p "$ROOT/build"

read -r -p "Server-URL (bv. http://voorbeeld.com:8080): " SERVER
read -r -p "Gebruikersnaam: " USERNAME
read -r -s -p "Wachtwoord (verborgen): " PASSWORD; echo
echo "Bezig met ophalen en indelen…"

XT_SERVER="${SERVER%/}" XT_USER="$USERNAME" XT_PASS="$PASSWORD" ROOT="$ROOT" OUT="$OUT" node - <<'JS'
const fs = require('fs'), vm = require('vm'), path = require('path');
const { XT_SERVER, XT_USER, XT_PASS, ROOT, OUT } = process.env;
const url = a => `${XT_SERVER}/player_api.php?username=${encodeURIComponent(XT_USER)}&password=${encodeURIComponent(XT_PASS)}&action=${a}`;
const arr = x => Array.isArray(x) ? x : Object.values(x || {});
(async () => {
  const [cats, all] = await Promise.all([fetch(url('get_series_categories')).then(r => r.json()), fetch(url('get_series')).then(r => r.json())]);
  // App-code laden met minimale vervangers
  const ctx = { console, Store: { settings: () => ({}) }, App: { catIds: s => (Array.isArray(s.category_ids) && s.category_ids.length ? s.category_ids : [s.category_id]).map(String) },
    Api: { series: () => Promise.resolve(arr(all)) } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/util.js'), 'utf8') + ';this.U=U;', ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/genres.js'), 'utf8') + ';this.Genres=Genres;', ctx);
  const G = ctx.Genres, lines = [];
  for (const g of G.LIST) {
    const items = await G.seriesItems(g.id, arr(cats));
    lines.push(`${String(items.length).padStart(6)}  ${g.name}`);
    if (g.id === 'horror') var horror = items;
  }
  lines.push('', '== Als Horror herkend (eerste 150):');
  horror.slice(0, 150).forEach(s => lines.push(`- ${s.name}  [${s.genre || ''}]`));
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  console.log('Klaar: ' + OUT);
})().catch(e => { console.error('Mislukt: ' + e.message); process.exit(1); });
JS
