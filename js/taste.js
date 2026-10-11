/* Smaak: "Vind ik leuk" / "Niet voor mij" per film en serie (lokaal, per profiel).
   - Telt mee in "Voor jou" en de genres "voor jou" (leuk +3, niet leuk −3 per genre)
   - "Niet voor mij" komt niet meer in aanbevelingen en gaat in genre-rijen naar achteren
   Opslag: { m: { <id van de provider>: { v: 1|-1, tmdb, name, at } }, t: { … } } */
var Taste = (function () {
    'use strict';

    var MAX = 500;   // per soort

    function all() { var d = Store.getP('taste', null) || {}; return { m: d.m || {}, t: d.t || {} }; }
    function idOf(type, it) {
        var id = type === 'm' ? (it.stream_id != null ? it.stream_id : it.id) : (it.series_id != null ? it.series_id : it.id);
        return String(id);
    }
    // 1 = leuk, −1 = niet voor mij, 0 = niets
    function get(type, it) { var e = all()[type][idOf(type, it)]; return e ? e.v : 0; }
    function set(type, it, v) {
        var d = all(), id = idOf(type, it);
        if (!v) delete d[type][id];
        else d[type][id] = { v: v, tmdb: String(Tmdb.idOf(it) || it.tmdb || ''), name: it.name || '', at: Date.now() };
        var keys = Object.keys(d[type]);
        if (keys.length > MAX) keys.sort(function (a, b) { return d[type][a].at - d[type][b].at; }).slice(0, keys.length - MAX).forEach(function (k) { delete d[type][k]; });
        Store.setP('taste', d);
    }
    // Lijst van beoordeelde titels, nieuwste eerst: [{ t, id, tmdb, name, v }]
    function list(v) {
        var d = all(), out = [];
        ['m', 't'].forEach(function (t) {
            Object.keys(d[t]).forEach(function (id) { var e = d[t][id]; if (!v || e.v === v) out.push({ t: t, id: id, tmdb: e.tmdb, name: e.name, v: e.v, at: e.at }); });
        });
        return out.sort(function (a, b) { return b.at - a.at; });
    }
    // "Niet voor mij" als sleutels 'm:<id>' en 'm:<tmdb>' (zelfde vorm als in rank.js)
    function disliked() {
        var s = {};
        list(-1).forEach(function (e) { s[e.t + ':' + e.id] = 1; if (e.tmdb) s[e.t + ':' + e.tmdb] = 1; });
        return s;
    }
    function sig() { var l = list(); return l.length + ':' + (l[0] ? l[0].at : 0); }

    return { get: get, set: set, list: list, disliked: disliked, sig: sig };
})();
