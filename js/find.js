/* Zoekindex voor zenders, films en series.
   - Zoekt in de naam van de provider én in de Nederlandse en originele TMDB-titel
   - Hele woorden, begin van woorden, stukjes van woorden en tikfouten ("matirx" -> "matrix")
   - Rangschikking: hoe goed de tekst past + bekendheid (TMDB-stemmen) + favoriet/recent bekeken
   De index wordt één keer opgebouwd (in stukjes, zodat de TV blijft reageren) en daarna per toets doorzocht. */
var Find = (function () {
    'use strict';

    var STOP = { de: 1, het: 1, een: 1, the: 1, a: 1, an: 1, of: 1, van: 1, en: 1, and: 1, la: 1, le: 1, les: 1, der: 1, die: 1, das: 1 };
    var CHUNK = 4000;      // items per stap bij het opbouwen
    var MAX_TYPE = 60;     // resultaten per soort

    var idx = null;        // { entries, tokens: Map(token -> [entry]), sorted: [token], byLen: [[token]] }

    // "NL | The Matrix (1999) [4K]" -> "nl the matrix 1999 4k" (genormaliseerde woorden)
    function words(s) {
        return U.norm(s).replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
    }
    // Naam zonder taalvoorvoegsel, haakjes en jaartal: voor de "hele titel"-bonus
    function cleanName(s) {
        return String(s || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/^\s*[A-Za-z]{2,5}\s*[|:\-–]\s+/, '').trim();
    }

    // Afstand tussen twee woorden (Damerau-Levenshtein, verwisseling telt als 1), stopt boven max
    function dist(a, b, max) {
        var la = a.length, lb = b.length;
        if (Math.abs(la - lb) > max) return max + 1;
        var prev2 = null, prev = new Array(lb + 1), cur;
        for (var j = 0; j <= lb; j++) prev[j] = j;
        for (var i = 1; i <= la; i++) {
            cur = new Array(lb + 1);
            cur[0] = i;
            var rowMin = i;
            for (j = 1; j <= lb; j++) {
                var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
                var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
                if (prev2 && i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) v = Math.min(v, prev2[j - 2] + 1);
                cur[j] = v;
                if (v < rowMin) rowMin = v;
            }
            if (rowMin > max) return max + 1;
            prev2 = prev;
            prev = cur;
        }
        return prev[lb];
    }
    function maxTypos(len) { return len >= 8 ? 2 : len >= 4 ? 1 : 0; }

    // ---- Opbouwen ----
    // data: { live: [...], movie: [...], series: [...] } (al zonder 18+ en dubbelen)
    function build(data, onProgress) {
        var list = [];
        (data.live || []).forEach(function (it) { list.push(['live', it]); });
        (data.movie || []).forEach(function (it) { list.push(['movie', it]); });
        (data.series || []).forEach(function (it) { list.push(['series', it]); });
        var next = { entries: [], tokens: new Map(), metaCount: Meta.count() };
        var pos = 0;
        return new Promise(function (resolve) {
            (function step() {
                var end = Math.min(list.length, pos + CHUNK);
                for (; pos < end; pos++) add(next, list[pos][0], list[pos][1]);
                if (onProgress) onProgress(pos, list.length);
                if (pos < list.length) { setTimeout(step, 0); return; }
                finish(next);
                idx = next;
                resolve(next);
            })();
        });
    }

    function add(ix, type, it) {
        var names = [it.name];
        if (type !== 'live') {
            var m = Meta.info(type === 'movie' ? 'm' : 't', it);
            if (m) { names.push(m.title); if (m.otitle && m.otitle !== m.title) names.push(m.otitle); }
        }
        var e = { type: type, item: it, names: [], pop: 0, n: ix.entries.length };
        if (m && m.votes) e.pop = Math.min(3, Math.log(1 + m.votes) / Math.LN10);
        var seen = {};
        names.forEach(function (n) {
            if (!n) return;
            var w = words(cleanName(n));
            if (w.length) e.names.push(w.join(' '));
            words(n).forEach(function (t) {
                if (seen[t]) return;
                seen[t] = 1;
                var arr = ix.tokens.get(t);
                if (arr) arr.push(e); else ix.tokens.set(t, [e]);
            });
        });
        ix.entries.push(e);
    }

    function finish(ix) {
        ix.sorted = Array.from(ix.tokens.keys()).sort();
        ix.byLen = [];
        ix.sorted.forEach(function (t) { (ix.byLen[t.length] = ix.byLen[t.length] || []).push(t); });
    }

    // ---- Zoeken ----
    // Alle woorden in de index die bij één zoekterm passen, met score: heel woord 3, begin 2.2, tikfout 1.6/1.3, stukje 1.2
    function termTokens(term) {
        var out = new Map(), ix = idx;
        if (ix.tokens.has(term)) out.set(term, 3);
        // Begin van een woord: binair zoeken in de gesorteerde lijst
        var lo = 0, hi = ix.sorted.length;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (ix.sorted[mid] < term) lo = mid + 1; else hi = mid; }
        for (var i = lo; i < ix.sorted.length && ix.sorted[i].lastIndexOf(term, 0) === 0; i++) if (!out.has(ix.sorted[i])) out.set(ix.sorted[i], 2.2);
        // Tikfouten
        var k = maxTypos(term.length);
        for (var len = term.length - k; k && len <= term.length + k; len++) {
            (ix.byLen[len] || []).forEach(function (t) {
                if (out.has(t)) return;
                var d = dist(term, t, k);
                if (d <= k) out.set(t, d === 1 ? 1.6 : 1.3);
            });
        }
        // Stukje van een langer woord ("matrix" in "thematrix")
        if (term.length >= 4) ix.sorted.forEach(function (t) { if (!out.has(t) && t.length > term.length && t.indexOf(term) > 0) out.set(t, 1.2); });
        return out;
    }

    // Per item de beste score voor deze term
    function termEntries(term) {
        var best = new Map();
        termTokens(term).forEach(function (score, tok) {
            idx.tokens.get(tok).forEach(function (e) { if ((best.get(e) || 0) < score) best.set(e, score); });
        });
        return best;
    }

    function queryTerms(q) {
        var terms = words(q);
        var real = terms.filter(function (t) { return !STOP[t]; });
        return real.length ? real : terms;
    }

    // Zoeken: { live, movie, series: [{ item, s }], best: { live, movie, series } } — per soort gesorteerd op score s
    function query(q, boost) {
        var out = { live: [], movie: [], series: [], best: { live: 0, movie: 0, series: 0 } };
        if (!idx) return out;
        var terms = queryTerms(q);
        if (!terms.length) return out;
        // Per term de passende items; doorsnede beginnen bij de kleinste set
        var sets = terms.map(termEntries).sort(function (a, b) { return a.size - b.size; });
        var phrase = words(q).join(' '), scored = [];
        sets[0].forEach(function (s0, e) {
            var total = s0;
            for (var i = 1; i < sets.length; i++) {
                var s = sets[i].get(e);
                if (!s) return;
                total += s;
            }
            total = total / terms.length * 3;   // gemiddelde per term, schaal 0-9
            total += phraseBonus(e.names, phrase) + e.pop * 0.6 + (boost ? boost(e.type, e.item) : 0);
            scored.push([total, e]);
        });
        scored.sort(function (a, b) { return b[0] - a[0]; });
        scored.forEach(function (x) {
            var list = out[x[1].type];
            if (list.length >= MAX_TYPE) return;
            if (!list.length) out.best[x[1].type] = x[0];
            list.push({ item: x[1].item, s: x[0] });
        });
        return out;
    }

    function phraseBonus(names, phrase) {
        var b = 0;
        for (var i = 0; i < names.length; i++) {
            var n = names[i];
            if (n === phrase) return 6;
            if (n.lastIndexOf(phrase, 0) === 0) b = Math.max(b, 3);
            else if (n.indexOf(' ' + phrase) >= 0) b = Math.max(b, 1.5);
        }
        return b;
    }

    // Hoe goed past de zoekopdracht bij één naam (bv. een persoon)? 0 = niet; zelfde schaal als query()
    function score(q, name) {
        var terms = queryTerms(q), toks = words(name);
        if (!terms.length || !toks.length) return 0;
        var total = 0;
        for (var i = 0; i < terms.length; i++) {
            var t = terms[i], best = 0;
            toks.forEach(function (w) {
                if (w === t) best = Math.max(best, 3);
                else if (w.lastIndexOf(t, 0) === 0) best = Math.max(best, 2.2);
                else if (maxTypos(t.length) && dist(t, w, maxTypos(t.length)) <= maxTypos(t.length)) best = Math.max(best, 1.5);
            });
            if (!best) return 0;
            total += best;
        }
        return total / terms.length * 3 + phraseBonus([toks.join(' ')], words(q).join(' '));
    }

    // "Bedoelde je …?": zoekwoorden die nergens mee beginnen of overeenkomen vervangen door het meest voorkomende woord
    // dat er het dichtst bij ligt (tot een derde van de letters anders). null = niets beters gevonden
    function suggest(q) {
        if (!idx) return null;
        var terms = words(q), changed = false;
        var out = terms.map(function (term) {
            if (term.length < 3 || STOP[term] || /^\d+$/.test(term) || idx.tokens.has(term)) return term;
            var lo = 0, hi = idx.sorted.length;
            while (lo < hi) { var mid = (lo + hi) >> 1; if (idx.sorted[mid] < term) lo = mid + 1; else hi = mid; }
            if (lo < idx.sorted.length && idx.sorted[lo].lastIndexOf(term, 0) === 0) return term;   // nog aan het typen
            var k = Math.max(1, Math.min(3, Math.floor(term.length / 3))), best = null, bestD = k + 1, bestN = 0;
            for (var len = term.length - k; len <= term.length + k; len++) {
                (idx.byLen[len] || []).forEach(function (t) {
                    if (/^\d+$/.test(t)) return;
                    var d = dist(term, t, k);
                    if (d > k) return;
                    var n = idx.tokens.get(t).length;
                    if (d < bestD || (d === bestD && n > bestN)) { best = t; bestD = d; bestN = n; }
                });
            }
            if (!best) return term;
            changed = true;
            return best;
        });
        if (!changed) return null;
        var s = out.join(' '), r = query(s);
        return r.live.length + r.movie.length + r.series.length ? s : null;
    }

    return {
        build: build, query: query, score: score, words: words, dist: dist, suggest: suggest,
        ready: function () { return !!idx; },
        // Opnieuw opbouwen als er sindsdien veel TMDB-titels bij zijn gekomen
        stale: function () { return !idx || Meta.count() > idx.metaCount * 1.05 + 50; },
        reset: function () { idx = null; }
    };
})();
