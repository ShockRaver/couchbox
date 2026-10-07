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
                    return list.length >= 3 ? { id: 'bc:' + s.t + s.id, title: T('Omdat je {title} keek', { title: (m && m.title) || s.name }), items: list } : null;
                });
            }).catch(function () { return null; });
        }));
    }

    // Trending deze week (TMDB), alleen wat jij hebt
    function trending(w, types) {
        var kind = types.length > 1 ? 'all' : types[0] === 'm' ? 'movie' : 'tv';
        var key = 'reco.trend.' + kind + '.' + I18N.lang(), c = Store.getGlobal(key, null);
        var get = c && Date.now() - c.at < TREND_TTL ? Promise.resolve(c.ids) : Promise.all([1, 2, 3].map(function (p) {
            return Tmdb.api('trending/' + kind + '/week', 'language=' + I18N.tmdb() + '&page=' + p).catch(function () { return null; });
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
            return list.length >= 3 ? { id: 'trend', title: T('Trending deze week'), items: list } : null;
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
            return items.length >= 5 ? { id: 'g:' + g, title: T('{genre} voor jou', { genre: T(Genres.byId(g).name) }), items: byRank(items) } : null;
        });
    }

    function topRated(list, w, types) {
        var items = pick(list.filter(function (x) { return x.m.votes >= 300; }).sort(function (a, b) { return b.q - a.q; }), w, types);
        return items.length >= 5 ? { id: 'top', title: T('Hoogst gewaardeerd'), items: byRank(items) } : null;
    }
    function dutch(list, w) {
        var items = pick(list.filter(function (x) {
            return x.type === 'm' && (x.m.lang === 'nl' || x.m.countries.indexOf('NL') >= 0 || x.m.countries.indexOf('BE') >= 0);
        }).sort(function (a, b) { return b.m.pop - a.m.pop; }), w, ['m']);
        return items.length >= 5 ? { id: 'nl', title: T('Nederlandse en Vlaamse films'), items: byRank(items) } : null;
    }
    function short(list, w) {
        var items = pick(list.filter(function (x) { return x.type === 'm' && x.m.runtime > 0 && x.m.runtime <= 90 && x.q >= 6.3; })
            .sort(function (a, b) { return b.m.pop - a.m.pop; }), w, ['m']);
        return items.length >= 5 ? { id: 'short', title: T('Korter dan 90 minuten'), items: byRank(items) } : null;
    }

    // "Binnenkort": series uit Mijn lijst met een nieuwe aflevering in de komende 3 weken (TMDB, één keer per dag per serie)
    var NEXT_TTL = 24 * 3600e3;
    function upcoming() {
        var favs = Store.favorites('series').filter(function (f) { return Tmdb.idOf(f); }).slice(-40);
        if (!favs.length) return Promise.resolve(null);
        var cache = Store.getGlobal('reco.next', {}) || {}, now = Date.now(), todo = favs.filter(function (f) {
            var c = cache[Tmdb.idOf(f)]; return !c || now - c.at > NEXT_TTL;
        }).slice(0, 15);
        // Eén voor één ophalen (rustig voor TMDB en de TV)
        var chain = todo.reduce(function (p, f) {
            return p.then(function () {
                var id = Tmdb.idOf(f);
                return Tmdb.api('tv/' + id, 'language=' + I18N.tmdb()).then(function (d) {
                    var n = d && d.next_episode_to_air;
                    cache[id] = { at: Date.now(), n: n && n.air_date ? { date: n.air_date, s: n.season_number, e: n.episode_number } : null };
                }).catch(function () { /* volgende keer */ });
            });
        }, Promise.resolve());
        return chain.then(function () {
            if (todo.length) Store.setGlobal('reco.next', cache);
            var today = new Date(); today.setHours(0, 0, 0, 0);
            var items = favs.map(function (f) {
                var c = cache[Tmdb.idOf(f)], n = c && c.n;
                if (!n) return null;
                var p = n.date.split('-'), t = new Date(+p[0], +p[1] - 1, +p[2]).getTime();
                if (t < today.getTime() || t > today.getTime() + 21 * 86400e3) return null;
                var when = t === today.getTime() ? T('vandaag') : t === today.getTime() + 86400e3 ? T('morgen') : U.fmtDate(t);
                return { type: 't', item: App.seriesFromFav(f), id: Tmdb.idOf(f), t: t, sub: 'S' + n.s + ' E' + n.e + ' · ' + when };
            }).filter(Boolean).sort(function (a, b) { return a.t - b.t; });
            return items.length ? { id: 'soon', title: T('Binnenkort'), items: items } : null;
        });
    }

    // ---- Zonder TMDB (of als TMDB nog weinig oplevert): alleen gegevens van de provider ----
    // Rating van de provider (0-10), of 0
    function pRating(it) {
        var r = parseFloat(it.rating);
        if (!(r > 0)) r = (parseFloat(it.rating_5based) || 0) * 2;
        return r > 10 ? r / 10 : r;
    }
    function basic(kind, w) {
        var types = kind === 'home' ? ['m', 't'] : [kind];
        return Promise.all([Api.vodCategories(), Api.seriesCategories()]).then(function (c) {
            return Promise.all(types.map(function (t) { return Genres.index(t, t === 'm' ? c[0] : c[1]); }));
        }).then(function (idxs) {
            var idx = {}, out = [];
            types.forEach(function (t, i) { idx[t] = idxs[i]; });
            var wrap = function (t) { return function (it) { return { type: t, item: it, id: Tmdb.idOf(it) || '' }; }; };
            var keyOf = function (t, it) { return String(t === 'm' ? it.stream_id : it.series_id); };
            // Genres waar jouw bekeken titels in zitten
            var mine = {}, srcs = [];
            Store.history().forEach(function (h) {
                var t = h.mode === 'movie' ? 'm' : 't', id = t === 'm' ? String(h.id) : h.series && String(h.series.id);
                if (id && idx[t] && srcs.length < 2 && !srcs.some(function (s) { return s.t === t && s.id === id; })) srcs.push({ t: t, id: id, name: t === 'm' ? h.name : h.series.name });
            });
            types.forEach(function (t) {
                Object.keys(idx[t]).forEach(function (g) {
                    if (g === '*' || !Genres.byId(g)) return;
                    idx[t][g].forEach(function (it) {
                        var k = keyOf(t, it);
                        srcs.forEach(function (s) { if (s.t === t && s.id === k) { (s.genres = s.genres || []).push(g); mine[g] = (mine[g] || 0) + 2; } });
                    });
                });
            });
            var best = function (list, t) {
                return list.slice().sort(function (a, b) { return pRating(b) - pRating(a) || (b._t || 0) - (a._t || 0); }).map(wrap(t));
            };
            // "Omdat je X keek": titels uit hetzelfde genre, best gewaardeerd eerst
            srcs.forEach(function (s) {
                var g = (s.genres || [])[0];
                if (!g) return;
                var items = pick(best(idx[s.t][g], s.t).filter(function (x) { return keyOf(s.t, x.item) !== s.id; }), w, [s.t]);
                if (items.length >= 5) out.push({ id: 'b:bc:' + s.t + s.id, title: T('Omdat je {title} keek', { title: s.name }), items: items });
            });
            // Jouw genre (behalve als het al in "Omdat je X keek" zit)
            var used = srcs.map(function (s) { return (s.genres || [])[0]; });
            Object.keys(mine).filter(function (g) { return used.indexOf(g) < 0; }).sort(function (a, b) { return mine[b] - mine[a]; }).slice(0, 1).forEach(function (g) {
                var items = [];
                types.forEach(function (t) { if (idx[t][g]) items = items.concat(best(idx[t][g], t)); });
                items = pick(items, w, types);
                if (items.length >= 5) out.push({ id: 'b:g:' + g, title: T('{genre} voor jou', { genre: T(Genres.byId(g).name) }), items: items });
            });
            // Nieuw en best gewaardeerd (rating van de provider)
            if (kind === 'home') {
                if (idx.m) out.push({ id: 'b:new-m', title: T('Nieuwe films'), items: pick(idx.m['*'].map(wrap('m')), w, ['m']) });
                if (idx.t) out.push({ id: 'b:new-t', title: T('Nieuwe series'), items: pick(idx.t['*'].map(wrap('t')), w, ['t']) });
            }
            var top = [];
            types.forEach(function (t) { top = top.concat(idx[t]['*'].filter(function (it) { return pRating(it) >= 7; }).slice(0, 2000)); });
            var topItems = pick(top.sort(function (a, b) { return pRating(b) - pRating(a); }).map(function (it) {
                return wrap(it.series_id != null && it.stream_id == null ? 't' : 'm')(it);
            }), w, types);
            if (topItems.length >= 5) out.push({ id: 'b:top', title: T('Hoogst gewaardeerd'), items: topItems });
            return out.filter(function (r) { return r.items.length >= 3; });
        }).catch(function () { return []; });
    }

    // ---- Samenstellen ----
    // kind: 'home' (films + series), 'm' of 't'. Geeft een vaste volgorde; lege rijen vallen weg.
    function build(kind) {
        var types = kind === 'home' ? ['m', 't'] : [kind], w = watched();
        // Geen TMDB: rijen op basis van de provider
        if (!Tmdb.enabled()) return basic(kind, w);
        return pool().then(function (list) {
            var soon = types.indexOf('t') >= 0 ? upcoming().catch(function () { return null; }) : Promise.resolve(null);
            return Promise.all([because(w, types, 2), trending(w, types), soon]).then(function (r) {
                var bc = r[0].filter(Boolean), out = [];
                if (bc[0]) out.push(bc[0]);
                if (r[1]) out.push(r[1]);
                if (r[2]) out.push(r[2]);
                if (bc[1]) out.push(bc[1]);
                genreRows(list, w, types, 2).forEach(function (g) { if (g) out.push(g); });
                out.push(topRated(list, w, types));
                if (types.indexOf('m') >= 0) { out.push(dutch(list, w)); out.push(short(list, w)); }
                out = out.filter(Boolean);
                // TMDB levert (nog) weinig op, bv. kort na installeren: aanvullen met rijen van de provider (zonder dubbele titels)
                if (out.length >= 3) return out;
                return basic(kind, w).then(function (extra) {
                    var titles = out.map(function (r) { return r.title; });
                    return out.concat(extra.filter(function (r) { return titles.indexOf(r.title) < 0; }));
                });
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
