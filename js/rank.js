/* Volgorde van films en series in de genre-rijen (Films/Series) en genre-overzichten.
   Niet meer alleen "laatst toegevoegd door de provider" (dat zijn vaak hele oude catalogi), maar een mix van:
   - hoe recent de titel is uitgekomen (jaar van TMDB, anders uit de naam of de providergegevens)
   - waardering (gewogen naar aantal stemmen, zoals bij "Hoogst gewaardeerd"; zonder TMDB de waardering van de provider)
   - bekendheid (TMDB)
   - hoe kort geleden de provider hem toevoegde (bij series: laatst bijgewerkt, dus nieuwe afleveringen)
   Daarbovenop per rij: elke dag iets andere volgorde bovenin, al gekeken titels naar achteren,
   en dezelfde titel niet vooraan in meerdere rijen. */
var Rank = (function () {
    'use strict';

    var TOP = 10;        // zoveel plekken vooraan in een rij zonder titels die al vooraan in een eerdere rij stonden
    var POOL = 200;      // alleen de beste zoveel per rij opnieuw schudden (snel op de TV)
    var OLD = 15;        // "Nieuw toegevoegd": titels die langer dan zoveel jaar geleden uitkwamen naar achteren

    function thisYear() { return new Date().getFullYear(); }

    // Jaar van uitkomen: TMDB, anders de providergegevens, anders een jaartal in de naam ("The Matrix (1999)")
    function yearOf(type, it, m) {
        var max = thisYear() + 2, ok = function (y) { return y >= 1900 && y <= max ? y : 0; };
        var y = ok(m && +m.year);
        if (!y) y = ok(parseInt(String(it.year || it.releaseDate || it.release_date || it.releasedate || '').slice(0, 4), 10));
        if (!y) {
            var all = String(it.name || '').match(/(?:^|\D)(19\d\d|20\d\d)(?!\d)/g);
            if (all) y = ok(parseInt(all[all.length - 1].replace(/\D/g, ''), 10));
        }
        return y;
    }

    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function providerRating(it) {
        var r = parseFloat(it.rating);
        if (!(r > 0)) r = (parseFloat(it.rating_5based) || 0) * 2;
        return r > 10 ? r / 10 : r;
    }

    // Vaste score per titel (0..1); wordt bij het opbouwen van de genre-index één keer berekend (it._r)
    function base(type, it) {
        var m = Meta.info(type, it), y = yearOf(type, it, m);
        var fresh = Math.exp(-(y ? Math.max(0, thisYear() - y) : 8) / 8);           // dit jaar 1, 8 jaar oud 0,37, 25 jaar 0,04
        var q;
        if (m && m.votes) q = (Reco.quality(m) - 5) / 3.5;                            // gewogen TMDB-waardering
        else { var r = providerRating(it); q = r > 0 ? 0.2 + (r - 5) / 3.5 * 0.6 : 0.35; } // provider: minder betrouwbaar
        var pop = m && m.pop ? Math.min(1, Math.log(1 + m.pop) / Math.log(200)) : 0.15;
        var t = it._t || parseInt(type === 't' ? it.last_modified : it.added, 10) || 0;
        var added = t ? Math.exp(-Math.max(0, Date.now() / 1000 - t) / 86400 / 45) : 0;
        return type === 't'
            ? 0.30 * fresh + 0.30 * clamp01(q) + 0.15 * pop + 0.25 * added
            : 0.35 * fresh + 0.30 * clamp01(q) + 0.20 * pop + 0.15 * added;
    }
    // Hele lijst op score sorteren (kopie); score opnieuw berekenen, want TMDB-gegevens kunnen intussen binnen zijn
    function sort(type, items) {
        items.forEach(function (it) { it._r = base(type, it); });
        return items.slice().sort(function (a, b) { return b._r - a._r; });
    }

    // Vaste "ruis" per titel per dag (0..0,05): de top van een rij verandert elke dag een beetje
    function jitter(key, day) {
        var s = key + ':' + day, h = 2166136261;
        for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return (h >>> 0) / 4294967295 * 0.05;
    }
    function keyOf(type, it) { return type + ':' + (Tmdb.idOf(it) || it.stream_id || it.series_id || it.name); }

    // Wat je al kijkt of gekeken hebt
    function seenSet() {
        var s = {};
        Store.history().forEach(function (h) {
            if (h.mode === 'movie') { s['m:' + h.id] = 1; if (h.tmdb) s['m:' + h.tmdb] = 1; }
            else if (h.series) { s['t:' + h.series.id] = 1; if (h.series.tmdb) s['t:' + h.series.tmdb] = 1; }
        });
        return s;
    }

    // Eén rij kiezen uit een op score gesorteerde lijst. used = { sleutel: 1 } gedeeld over de rijen van één scherm:
    // titels die al vooraan in een eerdere rij stonden, komen hier niet vooraan (wel verderop).
    function row(type, ranked, used, n) {
        var day = Math.floor(Date.now() / 864e5), seen = seenSet(), dis = Taste.disliked();
        var cand = ranked.slice(0, POOL).map(function (it) {
            var k = keyOf(type, it), id = type + ':' + (type === 'm' ? it.stream_id : it.series_id);
            var s = it._r + jitter(k, day) - (seen[k] || seen[id] || (type === 'm' && Store.isSeen('movie:' + it.stream_id)) ? 0.25 : 0);
            if (dis[k] || dis[id]) s -= 1;   // "Niet voor mij": ver naar achteren
            return { it: it, k: k, s: s };
        }).sort(function (a, b) { return b.s - a.s; });
        var front = [], rest = [];
        cand.forEach(function (c) { if (front.length < TOP && !(used && used[c.k])) front.push(c); else rest.push(c); });
        if (used) front.forEach(function (c) { used[c.k] = 1; });
        return front.concat(rest).slice(0, n || 40).map(function (c) { return c.it; });
    }

    // "Nieuw toegevoegd" blijft op datum van toevoegen, maar titels die al lang geleden uitkwamen gaan naar achteren
    function recent(type, newest, used, n) {
        var y0 = thisYear() - OLD, now = [], old = [];
        newest.slice(0, POOL).forEach(function (it) { var y = yearOf(type, it, Meta.info(type, it)); (y && y < y0 ? old : now).push(it); });
        var out = now.concat(old).slice(0, n || 40);
        if (used) out.slice(0, TOP).forEach(function (it) { used[keyOf(type, it)] = 1; });
        return out;
    }

    return { base: base, sort: sort, row: row, recent: recent, yearOf: yearOf, keyOf: keyOf, TOP: TOP };
})();
