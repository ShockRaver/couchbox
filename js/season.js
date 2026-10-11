/* Seizoenscategorieën: Halloween, Kerst & Sinterklaas, Valentijn.
   - Altijd te vinden als categorie (Categorieën → Genres); vanaf 4 weken vóór de datum ook als rij op Home, Films en Series
   - Titels: TMDB-trefwoorden (bv. "christmas"; lijst van TMDB, alleen wat in je bibliotheek staat), categorieën van de
     provider met zo'n naam ("NL | Kerstfilms"), en titels met zo'n woord ("A Christmas Story", "Halloween")
   - Volgorde: populair volgens TMDB eerst, daarna de rest op score (zie rank.js) */
var Season = (function () {
    'use strict';

    var DAY = 864e5, BEFORE = 28, TTL = 7 * DAY, PAGES = 5;

    // Namen blijven Nederlands (sleutels voor T()); dates(jaar) = de feestdag(en), het venster loopt van 4 weken vóór
    // de eerste tot en met de laatste dag
    var LIST = [
        { id: 'halloween', name: 'Halloween', dates: function (y) { return [new Date(y, 9, 31)]; },
            keywords: [3335, 232795, 9694], re: /\b(halloween|trick[\s-]?or[\s-]?treat|hocus[\s-]?pocus)\b/i },
        { id: 'kerst', name: 'Kerst & Sinterklaas', dates: function (y) { return [new Date(y, 11, 5), new Date(y, 11, 25)]; },
            keywords: [207317, 260365, 1991, 244375],
            re: /(kerst|christmas|x-?mas\b|sinterklaas|santa claus|santa clause|weihnacht|navidad|natale\b|grinch|nutcracker|notenkraker|rudolph|reindeer|rendier)/i },
        { id: 'valentijn', name: 'Valentijn', dates: function (y) { return [new Date(y, 1, 14)]; },
            keywords: [160404, 376604], re: /\b(valentijn\w*|valentine'?s?)\b/i }
    ];

    // Venster van een seizoen rond datum t: [begin, eind] (eind = einde van de laatste feestdag)
    function windowOf(s, t) {
        var y = new Date(t).getFullYear(), best = null;
        // Het eerste venster dat nog niet voorbij is (vorig, dit of volgend jaar)
        [y - 1, y, y + 1].forEach(function (yy) {
            var d = s.dates(yy).map(function (x) { return x.getTime(); });
            var w = [Math.min.apply(null, d) - BEFORE * DAY, Math.max.apply(null, d) + DAY];
            if (t < w[1] && (!best || w[0] < best[0])) best = w;
        });
        return best;
    }
    // Seizoenen die nu (of op datum t) getoond worden
    function active(t) {
        t = t || Date.now();
        return LIST.filter(function (s) { var w = windowOf(s, t); return t >= w[0] && t < w[1]; });
    }

    // TMDB-id's met de trefwoorden van dit seizoen (populair eerst), een week bewaard
    function tmdbIds(type, s) {
        if (!Tmdb.enabled()) return Promise.resolve([]);
        var key = 'season.' + s.id + '.' + type, c = Store.getGlobal(key, null);
        if (c && Date.now() - c.at < TTL) return Promise.resolve(c.ids);
        var pages = [];
        for (var p = 1; p <= PAGES; p++) pages.push(p);
        return Promise.all(pages.map(function (p) {
            return Tmdb.api('discover/' + (type === 't' ? 'tv' : 'movie'), 'with_keywords=' + s.keywords.join('|') + '&sort_by=popularity.desc&page=' + p).catch(function () { return null; });
        })).then(function (r) {
            var ids = [];
            r.forEach(function (d) { ((d && d.results) || []).forEach(function (x) { ids.push(String(x.id)); }); });
            if (ids.length) Store.setGlobal(key, { at: Date.now(), ids: ids });
            return ids;
        });
    }

    // Titels uit je bibliotheek die bij dit seizoen horen
    function items(type, s) {
        var catsP = type === 't' ? Api.seriesCategories() : Api.vodCategories();
        return catsP.then(function (cats) {
            return Promise.all([Genres.all(type, cats), tmdbIds(type, s)]).then(function (r) {
                var all = r[0], pos = {}, catOk = {};
                r[1].forEach(function (id, i) { if (!pos[id]) pos[id] = i + 1; });
                cats.forEach(function (c) { if (s.re.test(c.category_name || '')) catOk[String(c.category_id)] = 1; });
                var tm = [], rest = [];
                all.forEach(function (it) {
                    var id = Tmdb.idOf(it);
                    if (id && pos[id]) { tm.push(it); return; }
                    var m = Meta.info(type, it);
                    if (App.catIds(it).some(function (c) { return catOk[c]; }) || s.re.test(it.name || '') ||
                        (m && (s.re.test(m.title || '') || s.re.test(m.otitle || '')))) rest.push(it);
                });
                tm.sort(function (a, b) { return pos[Tmdb.idOf(a)] - pos[Tmdb.idOf(b)]; });
                return tm.concat(Rank.sort(type, rest));
            });
        });
    }

    // Rijen voor Home: films en series door elkaar, per actief seizoen (minstens 3 titels)
    function homeRows() {
        return Promise.all(active().map(function (s) {
            return Promise.all([items('m', s).catch(function () { return []; }), items('t', s).catch(function () { return []; })]).then(function (r) {
                var mix = [], i;
                for (i = 0; i < Math.max(r[0].length, r[1].length) && mix.length < 40; i++) {
                    if (r[0][i]) mix.push({ type: 'm', item: r[0][i] });
                    if (r[1][i]) mix.push({ type: 't', item: r[1][i] });
                }
                return mix.length >= 3 ? { id: 'season:' + s.id, title: T(s.name), items: mix.slice(0, 40) } : null;
            });
        })).then(function (rows) { return rows.filter(Boolean); });
    }

    return {
        LIST: LIST, active: active, windowOf: windowOf, items: items, homeRows: homeRows,
        byId: function (id) { return LIST.filter(function (s) { return s.id === id; })[0] || null; }
    };
})();
