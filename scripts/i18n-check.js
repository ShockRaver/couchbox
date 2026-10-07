#!/usr/bin/env node
// Controle van de vertalingen: elke T('…')-sleutel moet in js/lang/en.js staan, en er mogen geen
// Nederlandse teksten meer buiten T() staan. Gebruik: node scripts/i18n-check.js [bestand…]
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');

// Woordenboek inlezen
const dict = {};
global.I18N = { add: (l, o) => Object.assign(dict, o) };
eval(fs.readFileSync(path.join(root, 'js/lang/en.js'), 'utf8'));
// Extra (nog niet samengevoegde) vertalingen: I18N_EXTRA=build/i18n/a.json,build/i18n/b.json
(process.env.I18N_EXTRA || '').split(',').filter(Boolean).forEach(f => { if (fs.existsSync(f)) Object.assign(dict, JSON.parse(fs.readFileSync(f, 'utf8'))); });

const SKIP = ['js/config.js', 'js/config.local.js', 'js/build.js', 'js/lang/en.js', 'js/i18n.js', 'js/demo.js'];
const files = process.argv.slice(2).length ? process.argv.slice(2) : [
    ...fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f),
    ...fs.readdirSync(path.join(root, 'js/screens')).map(f => 'js/screens/' + f)
].filter(f => !SKIP.includes(f));

// Opmerkingen weghalen (strings blijven staan)
function stripComments(src) {
    let out = '', i = 0, q = null;
    while (i < src.length) {
        const c = src[i], n = src[i + 1];
        if (q) { out += c; if (c === '\\') { out += n; i += 2; continue; } if (c === q) q = null; i++; continue; }
        if (c === "'" || c === '"' || c === '`') { q = c; out += c; i++; continue; }
        if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
        if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
        // Reguliere expressie: overslaan tot de afsluitende /
        if (c === '/' && /[=(,:!&|?{};\[]\s*$/.test(out.slice(-20))) {
            out += c; i++;
            while (i < src.length && src[i] !== '/') { if (src[i] === '\\') { out += src[i]; i++; } if (src[i] === '[') { while (src[i] !== ']') { out += src[i]; i++; } } out += src[i]; i++; }
            out += '/'; i++; continue;
        }
        out += c; i++;
    }
    return out;
}

const used = new Set();
let missing = [], loose = [];
// Woorden die op Nederlandse UI-tekst wijzen
const NL = /\b(de|het|een|en|van|je|jouw|niet|geen|nog|voor|met|naar|op|is|bij|om|of|uit|wordt|worden|kan|kijken|zender|zenders|films?|series|serie|aflevering|afleveringen|instellingen|laden|zoeken|terug|verder|lijst|mijn|nieuw|nieuwe|bezig|klaar|fout|mislukt|verwijderen|toevoegen|opslaan|annuleren|afspelen|gids|programma|ondertitels|uitgezet|aan|uit|seizoen|seizoenen|minuten|vandaag|morgen|gisteren|sleutel)\b/i;
for (const f of files) {
    const src = stripComments(fs.readFileSync(path.join(root, f), 'utf8'));
    // T('…') en T("…")
    const re = /\bT\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
    let m;
    const inT = [];
    while ((m = re.exec(src))) {
        const key = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n');
        used.add(key);
        inT.push([m.index, m.index + m[0].length]);
        if (!(key in dict)) missing.push(`${f}: ${JSON.stringify(key)}`);
    }
    // Losse strings die op Nederlandse tekst lijken (niet binnen T())
    const sre = /(['"])((?:\\.|(?!\1).)*)\1/g;
    while ((m = sre.exec(src))) {
        if (inT.some(([a, b]) => m.index >= a && m.index < b)) continue;
        const s = m[2];
        if (s.length < 3 || !/[a-zà-ÿ]{2,}/i.test(s) || !/\s/.test(s) && !/^[A-Z][a-z]/.test(s)) continue;
        if (/^(https?:|#|\.|\/|<\/?[a-z]+[ >]|[a-z-]+:|data-|[\w-]+\s*\(|application\/|video\/)/.test(s)) continue;
        if (NL.test(s) || /[éëèêïöüó]/.test(s)) loose.push(`${f}: ${JSON.stringify(s)}`);
    }
}
const unused = Object.keys(dict).filter(k => !used.has(k));
console.log(`Sleutels in code: ${used.size}, in woordenboek: ${Object.keys(dict).length}`);
if (missing.length) console.log(`\nZonder Engelse vertaling (${missing.length}):\n  ` + missing.join('\n  '));
if (loose.length) console.log(`\nMogelijk nog niet vertaalbaar (buiten T()) (${loose.length}):\n  ` + loose.join('\n  '));
if (unused.length && !process.argv.slice(2).length) console.log(`\nOngebruikt in woordenboek (${unused.length}):\n  ` + unused.slice(0, 50).join('\n  '));
process.exit(missing.length ? 1 : 0);
