/* Externe ondertitels via OpenSubtitles.com (eigen API-sleutel nodig: gratis account op opensubtitles.com).
   - Zoeken op TMDB-id (film, of serie + seizoen + aflevering); zonder TMDB-id op titel (en jaar)
   - Downloaden (SRT of WebVTT) en zelf tonen op de tijd van de speler (zie screens/player.js)
   - Gedownloade ondertitels blijven lokaal bewaard (IndexedDB), zodat hervatten geen nieuwe download kost:
     OpenSubtitles staat maar een beperkt aantal downloads per dag toe
   - De API wil de parameters in alfabetische volgorde en in kleine letters (anders een omleiding) */
var Subs = (function () {
    'use strict';

    var API = 'https://api.opensubtitles.com/api/v1/';
    var KEEP = 40;   // zoveel gedownloade bestanden bewaren

    function key() { return String(Store.settings().osKey || (window.CONFIG && CONFIG.osKey) || '').trim(); }
    function enabled() { return !!key(); }
    function base() { return (window.CONFIG && CONFIG.osApi) || API; }

    function req(path, params, body) {
        var qs = Object.keys(params || {}).filter(function (k) { return params[k] !== '' && params[k] != null; }).sort().map(function (k) {
            return k + '=' + encodeURIComponent(String(params[k]).toLowerCase());
        }).join('&');
        var o = {
            method: body ? 'POST' : 'GET',
            // Browsers mogen User-Agent niet zetten; OpenSubtitles accepteert daarom X-User-Agent
            headers: { 'Api-Key': key(), 'X-User-Agent': 'Kijkdoos v' + ((window.App && App.VERSION) || '1'), 'Accept': 'application/json' }
        };
        if (body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
        return fetch(base() + path + (qs ? '?' + qs : ''), o).then(function (r) {
            return r.text().then(function (t) {
                var d = null;
                try { d = t ? JSON.parse(t) : null; } catch (e) { /* geen JSON */ }
                if (r.ok) return d;
                var msg = (d && (d.message || (d.errors && d.errors.join(', ')))) || 'HTTP ' + r.status;
                if (r.status === 401 || r.status === 403) msg = T('OpenSubtitles weigert de sleutel ({error})', { error: msg });
                var err = new Error(msg);
                err.status = r.status;
                throw err;
            });
        });
    }

    // Titel zonder taalvoorvoegsel, haakjes en jaartal ("NL | The Matrix (1999) [4K]" -> "The Matrix")
    function clean(s) {
        return String(s || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/^\s*[A-Za-z]{2,5}\s*[|:\-–]\s+/, '')
            .replace(/\b(19|20)\d{2}\b|\b(4k|uhd|fhd|hd|multi|sub)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    }
    function yearOf(s) { var m = String(s || '').match(/\b(19[2-9]\d|20[0-4]\d)\b/); return m ? m[1] : ''; }

    // o: { kind: 'm'|'t', tmdb (film) | seriesTmdb + season + episode, name, langs: ['nl', 'en'] }
    // -> [{ fileId, lang, label, release, downloads, hi, ai }] (gewenste taal eerst, daarna het meest gedownload)
    function search(o) {
        var langs = (o.langs || []).filter(Boolean), p = { languages: langs.slice().sort().join(',') };
        if (o.kind === 'm') {
            p.type = 'movie';
            if (o.tmdb) p.tmdb_id = o.tmdb; else { p.query = clean(o.name); p.year = yearOf(o.name); }
        } else {
            p.type = 'episode';
            p.season_number = o.season;
            p.episode_number = o.episode;
            if (o.seriesTmdb) p.parent_tmdb_id = o.seriesTmdb; else p.query = clean(o.name);
        }
        return req('subtitles', p).then(function (d) {
            var out = [];
            ((d && d.data) || []).forEach(function (x) {
                var a = x.attributes || {}, f = (a.files || [])[0];
                if (!f || !f.file_id) return;
                var lang = U.normLang(String(a.language || '').split('-')[0]);
                out.push({
                    fileId: f.file_id, lang: lang, label: U.langLabel(lang), release: a.release || f.file_name || '',
                    downloads: +a.download_count || 0, hi: !!a.hearing_impaired, ai: !!(a.ai_translated || a.machine_translated)
                });
            });
            var rank = function (s) { var i = langs.indexOf(s.lang); return i < 0 ? 99 : i; };
            return out.sort(function (a, b) { return rank(a) - rank(b) || (a.ai - b.ai) || (a.hi - b.hi) || b.downloads - a.downloads; });
        });
    }

    // ---- Downloaden en bewaren ----
    function cacheKey(fileId) { return 'sub|' + fileId; }
    function remember(fileId) {
        var list = (Store.getGlobal('subs.files', []) || []).filter(function (x) { return x !== fileId; });
        list.unshift(fileId);
        list.slice(KEEP).forEach(function (old) { Db.del('lists', cacheKey(old)).catch(function () {}); });
        Store.setGlobal('subs.files', list.slice(0, KEEP));
    }
    // Ondertitels ophalen (uit de lokale opslag of via OpenSubtitles); resolve met { cues, remaining }
    function load(fileId) {
        return Db.get('lists', cacheKey(fileId)).catch(function () { return null; }).then(function (txt) {
            if (txt) return { cues: parse(txt), remaining: null };
            return req('download', {}, { file_id: fileId }).then(function (d) {
                if (!d || !d.link) throw new Error((d && d.message) || T('Geen downloadlink ontvangen'));
                return fetch(d.link).then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.arrayBuffer();
                }).then(function (buf) {
                    var txt = decode(buf), cues = parse(txt);
                    if (!cues.length) throw new Error(T('Het bestand bevat geen ondertitels'));
                    Db.put('lists', cacheKey(fileId), txt).catch(function () {});
                    remember(fileId);
                    return { cues: cues, remaining: d.remaining != null ? +d.remaining : null };
                });
            });
        });
    }
    // UTF-8, en anders Windows-1252 (oudere SRT-bestanden)
    function decode(buf) {
        try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { /* geen UTF-8 */ }
        try { return new TextDecoder('windows-1252').decode(buf); } catch (e) { return new TextDecoder().decode(buf); }
    }

    // ---- SRT / WebVTT lezen: [{ s, e, text }] in milliseconden ----
    var TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})\s*-->\s*(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/;
    function ms(h, m, s, f) { return ((+h || 0) * 3600 + +m * 60 + +s) * 1000 + +((f + '00').slice(0, 3)); }
    function parse(txt) {
        var out = [];
        String(txt || '').replace(/^﻿/, '').replace(/\r/g, '').split(/\n\s*\n/).forEach(function (b) {
            var lines = b.split('\n'), i = 0;
            while (i < lines.length && lines[i].indexOf('-->') < 0) i++;
            var m = i < lines.length && lines[i].match(TIME);
            if (!m) return;
            var text = lines.slice(i + 1).join('\n').replace(/\{\\[^}]*\}/g, '').replace(/<[^>]*>/g, '').trim();
            if (text) out.push({ s: ms(m[1], m[2], m[3], m[4]), e: ms(m[5], m[6], m[7], m[8]), text: text });
        });
        return out.sort(function (a, b) { return a.s - b.s; });
    }
    // Tekst op tijdstip t (ms); overlappende regels samen
    function at(cues, t) {
        var lo = 0, hi = cues.length - 1, i = -1;
        while (lo <= hi) { var mid = (lo + hi) >> 1; if (cues[mid].s <= t) { i = mid; lo = mid + 1; } else hi = mid - 1; }
        var parts = [];
        for (var j = i; j >= 0 && j > i - 4; j--) if (cues[j].e > t) parts.unshift(cues[j].text);
        return parts.join('\n');
    }

    return { enabled: enabled, search: search, load: load, parse: parse, at: at, clean: clean, req: req };
})();
