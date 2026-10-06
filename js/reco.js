/* Aanbevelingen ("Voor jou"): rijen op basis van je kijkgeschiedenis, TMDB en je eigen bibliotheek.
   Alles wat getoond wordt staat in jouw IPTV-bibliotheek; al bekeken titels en "Verder kijken" worden overgeslagen.
   Resultaten worden even bewaard, zodat het startscherm direct kan tekenen en daarna stil ververst. */
var Reco = (function () {
    'use strict';

    var ROW_MAX = 30;
    var TTL = 15 * 60e3;          // rijen opnieuw berekenen na 15 minuten of als je iets nieuws kijkt
    var TREND_TTL = 12 * 3600e3;  // trending-lijst van TMDB een halve dag bewaren
    var cache = {};               // per soort ('home', 'm', 't'): { at, sig, rows }

    // ---- Bibliotheek met TMDB-gegevens ----
    var poolC = { map: null, n: -1, list: null };
    function pool() {
        return Meta.library().then(function (map) {
            if (poolC.map === map && poolC.n === Meta.count()) return poolC.list;
            var list = [], n = Meta.count();
            var add = function (t) {
                return U.each(Array.from(map[t]), function (e) {
                    var m = Meta.byId(t, e[0]);
                    if (m) list.push({ type: t, item: e[1], id: e[0], m: m, q: quality(m) });
                }, 3000);
            };
            return add('m').then(function () { return add('t'); }).then(function () {
                poolC = { map: map, n: n, list: list };
                return list;
            });
        });
    }
    // Gewogen waardering: weinig stemmen trekt naar het gemiddelde (6,5), zodat obscure 9,8's niet bovenaan staan
    function quality(m) {
        var v = m.votes || 0, C = 6.5, k = 400;
        return (v / (v + k)) * (m.rating || 0) + (k / (v + k)) * C;
    }

    // ---- Wat je al kijkt/gekeken hebt ----
    function watched() {
        var w = { m: {}, t: {}, tmdb: { m: {}, t: {} } };
        Store.history().forEach(function (h) {
            if (h.mode === 'movie') { w.m[String(h.id)] = 1; if (h.tmdb) w.tmdb.m[String(h.tmdb)] = 1; }
            else if (h.series) { w.t[String(h.series.id)] = 1; if (h.series.tmdb) w.tmdb.t[String(h.series.tmdb)] = 1; }
        });
        return w;
    }
    function fresh(w) {
        return function (x) {
            if (x.type === 'm') return !w.m[String(x.item.stream_id)] && !w.tmdb.m[String(x.id)] && !Store.isSeen('movie:' + x.item.stream_id);
            return !w.t[String(x.item.series_id)] && !w.tmdb.t[String(x.id)];
        };
    }
    function pick(list, w, types) {
        return list.filter(function (x) { return types.indexOf(x.type) >= 0; }).filter(fresh(w)).slice(0, ROW_MAX);
    }
    function byRank(list) { return list.map(function (x) { return { type: x.type || x.t, item: x.item, id: String(x.id || '') }; }); }

    // ---- Rijen ----
    // "Omdat je X keek": TMDB-aanbevelingen bij de laatst bekeken titels
    function because(w, types, n) {
        var seen = {}, src = [];
        Store.history().forEach(function (h) {
            var t = h.mode === 'movie' ? 'm' : 't', id = t === 'm' ? h.tmdb : h.series && h.series.tmdb;
            if (!id || types.indexOf(t) < 0 || seen[t + id] || src.length >= n) return;
            seen[t + id] = 1;
            src.push({ t: t, id: String(id), name: t === 'm' ? h.name : h.series.name });
        });
        return Promise.all(src.map(function (s) {
            return Meta.details(s.t, s.id).then(function (det) {
                if (!det || !det.recs || !det.recs.length) return null;
                return Meta.inLibrary(det.recs.map(function (id) { return { t: s.t, id: id }; })).then(function (found) {
                    var list = pick(found.map(function (f) { return { type: f.type, item: f.item, id: Tmdb.idOf(f.item) }; }), w, types);
                    var m = Meta.byId(s.t, s.id);
                    return list.length >= 3 ? { id: 'bc:' + s.t + s.id, title: 'Omdat je ' + ((m && m.title) || s.name) + ' keek', items: list } : null;
                });
            }).catch(function () { return null; });
        }));
    }

    // Trending deze week (TMDB), alleen wat jij hebt
    function trending(w, types) {
        var kind = types.length > 1 ? 'all' : types[0] === 'm' ? 'movie' : 'tv';
        var key = 'reco.trend.' + kind, c = Store.getGlobal(key, null);
        var get = c && Date.now() - c.at < TREND_TTL ? Promise.resolve(c.ids) : Promise.all([1, 2, 3].map(function (p) {
            return Tmdb.api('trending/' + kind + '/week', 'language=nl-NL&page=' + p).catch(function () { return null; });
        })).then(function (pages) {
            var ids = [];
            pages.forEach(function (d) {
                ((d && d.results) || []).forEach(function (x) {
                    var t = x.media_type === 'tv' || kind === 'tv' ? 't' : 'm';
                    if (x.media_type === 'person') return;
                    ids.push({ t: t, id: x.id });
                });
            });
            if (ids.length) Store.setGlobal(key, { at: Date.now(), ids: ids });
            return ids;
        });
        return get.then(function (ids) { return Meta.inLibrary(ids); }).then(function (found) {
            var list = pick(found.map(function (f) { return { type: f.type, item: f.item, id: Tmdb.idOf(f.item) }; }), w, types);
            return list.length >= 3 ? { id: 'trend', title: 'Trending deze week', items: list } : null;
        }).catch(function () { return null; });
    }

    // Jouw favoriete genres (uit wat je kijkt en bewaart)
    function favGenres(types) {
        var count = {};
        var add = function (t, tmdb, wgt) {
            if (!tmdb || types.indexOf(t) < 0) return;
            (Tmdb.genres(t, { tmdb: tmdb }) || []).forEach(function (g) { count[g] = (count[g] || 0) + wgt; });
        };
        Store.history().forEach(function (h) { if (h.mode === 'movie') add('m', h.tmdb, 2); else if (h.series) add('t', h.series.tmdb, 2); });
        Store.favorites('movie').forEach(function (f) { add('m', f.tmdb, 1); });
        Store.favorites('series').forEach(function (f) { add('t', f.tmdb, 1); });
        return Object.keys(count).filter(function (g) { return count[g] >= 2 && Genres.byId(g); })
            .sort(function (a, b) { return count[b] - count[a]; });
    }
    function genreRows(list, w, types, n) {
        return favGenres(types).slice(0, n).map(function (g) {
            var items = list.filter(function (x) { var gs = Tmdb.genres(x.type, x.item); return gs && gs.indexOf(g) >= 0; })
                .sort(function (a, b) { return (b.q + Math.log(1 + b.m.pop) / 3) - (a.q + Math.log(1 + a.m.pop) / 3); });
            items = pick(items, w, types);
            return items.length >= 5 ? { id: 'g:' + g, title: Genres.byId(g).name + ' voor jou', items: byRank(items) } : null;
        });
    }

    function topRated(list, w, types) {
        var items = pick(list.filter(function (x) { return x.m.votes >= 300; }).sort(function (a, b) { return b.q - a.q; }), w, types);
        return items.length >= 5 ? { id: 'top', title: 'Hoogst gewaardeerd', items: byRank(items) } : null;
    }
    function dutch(list, w) {
        var items = pick(list.filter(function (x) {
            return x.type === 'm' && (x.m.lang === 'nl' || x.m.countries.indexOf('NL') >= 0 || x.m.countries.indexOf('BE') >= 0);
        }).sort(function (a, b) { return b.m.pop - a.m.pop; }), w, ['m']);
        return items.length >= 5 ? { id: 'nl', title: 'Nederlandse en Vlaamse films', items: byRank(items) } : null;
    }
    function short(list, w) {
        var items = pick(list.filter(function (x) { return x.type === 'm' && x.m.runtime > 0 && x.m.runtime <= 90 && x.q >= 6.3; })
            .sort(function (a, b) { return b.m.pop - a.m.pop; }), w, ['m']);
        return items.length >= 5 ? { id: 'short', title: 'Korter dan 90 minuten', items: byRank(items) } : null;
    }

    // ---- Samenstellen ----
    // kind: 'home' (films + series), 'm' of 't'. Geeft een vaste volgorde; lege rijen vallen weg.
    function build(kind) {
        var types = kind === 'home' ? ['m', 't'] : [kind], w = watched();
        if (!Tmdb.enabled()) return Promise.resolve([]);
        return pool().then(function (list) {
            return Promise.all([because(w, types, 2), trending(w, types)]).then(function (r) {
                var bc = r[0].filter(Boolean), out = [];
                if (bc[0]) out.push(bc[0]);
                if (r[1]) out.push(r[1]);
                if (bc[1]) out.push(bc[1]);
                genreRows(list, w, types, 2).forEach(function (g) { if (g) out.push(g); });
                out.push(topRated(list, w, types));
                if (types.indexOf('m') >= 0) { out.push(dutch(list, w)); out.push(short(list, w)); }
                return out.filter(Boolean);
            });
        });
    }

    // Kenmerk van je kijkgedrag: verandert dit, dan opnieuw berekenen
    function sig() {
        return Store.history().slice(0, 6).map(function (h) { return h.key; }).join(',') + '|' +
            Store.favorites('movie').length + ',' + Store.favorites('series').length + '|' + Math.floor(Meta.count() / 500);
    }

    var pending = {};
    return {
        // Laatst berekende rijen (meteen beschikbaar), of []
        cached: function (kind) { var c = cache[kind]; return c ? c.rows : []; },
        stale: function (kind) { var c = cache[kind]; return !c || Date.now() - c.at > TTL || c.sig !== sig(); },
        // Opnieuw berekenen; resolve met de rijen (één berekening tegelijk per soort)
        refresh: function (kind) {
            if (pending[kind]) return pending[kind];
            var s = sig();
            pending[kind] = build(kind).then(function (rows) {
                cache[kind] = { at: Date.now(), sig: s, rows: rows };
                return rows;
            }).catch(function (e) { console.warn('Aanbevelingen mislukt', e); return cache[kind] ? cache[kind].rows : []; })
                .then(function (rows) { delete pending[kind]; return rows; });
            return pending[kind];
        },
        reset: function () { cache = {}; poolC = { map: null, n: -1, list: null }; },
        quality: quality
    };
})();
