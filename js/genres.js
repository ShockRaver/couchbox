/* Genres voor films en series: één indeling over alle providercategorieën en talen heen.
   Series: op basis van het genre per serie (TMDB) + categorienaam.
   Films: de provider levert geen genre per film, dus op basis van categorienamen. */
var Genres = (function () {
    'use strict';

    // Regex werkt op genormaliseerde tekst (kleine letters, zonder accenten)
    var LIST = [
        { id: 'actie', name: 'Actie', re: /(actie|action|aksiyon|accion|aktion|حركة)/ },
        { id: 'avontuur', name: 'Avontuur', re: /(avontuur|adventure|macera|aventura|abenteuer|مغامرة)/ },
        { id: 'animatie', name: 'Animatie & Anime', re: /(animat|anime|cartoon|crunchyroll|tekenfilm)/ },
        { id: 'kids', name: 'Kids', re: /(\bkids\b|kinder|jeugd|baby|peuter|infantil|enfant|\bk3\b|\bnick|cartoon network|اطفال)/ },
        { id: 'familie', name: 'Familie', re: /(famil|\baile\b)/ },
        { id: 'komedie', name: 'Komedie', re: /(komedi|comed|komodie|cabaret)/ },
        { id: 'drama', name: 'Drama', re: /(\bdram(a|e)?\b|δραμα|دراما)/ },
        { id: 'romantiek', name: 'Romantiek', re: /(romant|romance|liebes)/ },
        { id: 'thriller', name: 'Thriller & Mysterie', re: /(thriller|myster|gizem|μυστηρ)/ },
        { id: 'misdaad', name: 'Misdaad', re: /(misdaad|crime|crimen|\bsuc\b|krimi)/ },
        // TMDB kent voor series geen "Horror"; daarom ook herkennen aan titel en beschrijving (plotRe)
        { id: 'horror', name: 'Horror', re: /(horror|korku)/,
            plotRe: /\b(horror\w*|zombies?|vampie?re?s?|vampir\w*|weerwol\w*|werewol\w*|demons?|demonen|demonic|demonisch\w*|exorcis\w*|possessed|spookhuis|haunted|haunting|slasher|griezel\w*|poltergeist)\b/,
            notWith: ['kids', 'docu', 'animatie'] },
        { id: 'scifi', name: 'Science fiction', re: /(sci-?fi|science fiction|bilim kurgu|επ\.? φαντασ)/ },
        { id: 'fantasy', name: 'Fantasy', re: /(fantas|fantaz|φαντασ)/ },
        { id: 'oorlog', name: 'Oorlog & Geschiedenis', re: /(oorlog|\bwar\b|savas|histor|politi)/ },
        { id: 'western', name: 'Western', re: /western/ },
        { id: 'docu', name: 'Documentaire', re: /(docu|dokument|documental|national geographic|ντοκυμαντ)/ },
        { id: 'reality', name: 'Reality', re: /(realit|rality|raelity|spelshow|game ?show|واقع)/ },
        { id: 'programma', name: 'Talkshows & Programma\'s', re: /(talk|programm|programa|progarmma|tv[ -]?shows?\b|\bshows?\b|lifestyle|human interest)/ },
        { id: 'soap', name: 'Soap', re: /(soap|pembe dizi)/ },
        { id: 'muziek', name: 'Muziek & Concerten', re: /(music|muziek|musik|concert|festival)/ },
        { id: 'sport', name: 'Sport', re: /(sport|\bufc\b|\bwwe\b|\bf1\b|nascar|mxgp|motocross|darts|\bboks\b|glory|\bpfl\b)/ },
        { id: 'feest', name: 'Kerst & Sinterklaas', re: /(kerst|christmas|sinterklaas)/ },
        { id: 'bollywood', name: 'Bollywood & Indiaas', re: /(bollywood|hindi|indian)/ },
        { id: 'nieuws', name: 'Nieuws', re: /(\bnews\b|nieuws)/ }
    ];
    var BY_ID = {};
    LIST.forEach(function (g) { BY_ID[g.id] = g; });

    var LANG_NAMES = { NL: 'Nederlands', BE: 'België', EN: 'Engels', MULTI: 'Meertalig', DE: 'Duits', FR: 'Frans', ES: 'Spaans', IT: 'Italiaans', TR: 'Turks', AR: 'Arabisch', ASIA: 'Aziatisch', GR: 'Grieks', UK: 'Brits', USA: 'Amerikaans', US: 'Amerikaans' };
    var DEFAULT_LANGS = ['NL', 'BE', 'MULTI', 'EN'];

    // "┃NL┃ HORROR", "[EN] Action", "NL | Actie" -> { lang: 'NL', rest: 'horror' }
    function splitName(name) {
        var s = String(name || '').trim();
        var m = s.match(/^[┃|\[]\s*([^┃|\]]+?)\s*[┃|\]]\s*(.*)$/) || s.match(/^([A-Za-z]{2,5})\s*[|:\-]\s+(.*)$/);
        if (!m) return { lang: '', rest: U.norm(s) };
        return { lang: m[1].split(/[\s/]+/)[0].toUpperCase(), rest: U.norm(m[2]) };
    }

    function match(text) {
        var t = U.norm(text), out = [];
        if (!t) return out;
        for (var i = 0; i < LIST.length; i++) if (LIST[i].re.test(t)) out.push(LIST[i].id);
        return out;
    }

    // Talen die in de categorieën voorkomen, in volgorde van voorkomen
    function langsIn(cats) {
        var seen = {}, out = [];
        U.toArr(cats).forEach(function (c) { var l = splitName(c.category_name).lang; if (l && !seen[l]) { seen[l] = 1; out.push(l); } });
        return out;
    }

    // Gekozen talen; null = geen filter. Standaard NL/BE/MULTI/EN als die bestaan.
    function activeLangs(cats) {
        var s = Store.settings().genreLangs;
        if (Array.isArray(s)) return s.length ? s : null;
        var present = langsIn(cats), pick = DEFAULT_LANGS.filter(function (l) { return present.indexOf(l) >= 0; });
        return pick.length ? pick : null;
    }

    // Per categorie: taal, rangorde (voor dubbelen) en genres op basis van de naam
    function catInfo(cats) {
        var langs = activeLangs(cats), info = {};
        U.toArr(cats).forEach(function (c, i) {
            var sp = splitName(c.category_name);
            var ok = !langs || !sp.lang || langs.indexOf(sp.lang) >= 0;
            var rank = (langs && sp.lang ? langs.indexOf(sp.lang) : 50) * 10000 + i;
            info[String(c.category_id)] = { ok: ok, rank: rank, genres: match(sp.rest) };
        });
        return info;
    }

    function tmdbKey(it) {
        var t = String(it.tmdb || it.tmdb_id || '').trim();
        return t && t !== '0' ? 't' + t : 'n' + U.norm(it.name).replace(/\s*\(\d{4}\)\s*$/, '').replace(/[^a-z0-9]+/g, '');
    }

    // Dubbele titels samenvoegen: versie uit de categorie met de hoogste voorkeur wint
    function dedupe(items, info) {
        var best = {};
        items.forEach(function (it) {
            var k = tmdbKey(it), r = Math.min.apply(null, App.catIds(it).map(function (id) { return info[id] ? info[id].rank : 1e9; }));
            if (!best[k] || r < best[k].r) best[k] = { it: it, r: r };
        });
        return Object.keys(best).map(function (k) { return best[k].it; });
    }

    function newest(field) {
        return function (a, b) { return (parseInt(b[field], 10) || 0) - (parseInt(a[field], 10) || 0); };
    }

    // Genres die TMDB voor films kan leveren
    var MOVIE_TMDB = ['actie', 'avontuur', 'animatie', 'familie', 'komedie', 'drama', 'romantiek', 'thriller', 'misdaad', 'horror',
        'scifi', 'fantasy', 'oorlog', 'western', 'docu', 'muziek'];

    // ---- Films: genres uit categorienamen, aangevuld met TMDB ----
    function movieGenres(cats) {
        var info = catInfo(cats), count = {};
        Object.keys(info).forEach(function (id) { if (info[id].ok) info[id].genres.forEach(function (g) { count[g] = (count[g] || 0) + 1; }); });
        if (Tmdb.enabled()) MOVIE_TMDB.forEach(function (g) { count[g] = (count[g] || 0) + 1; });
        return LIST.filter(function (g) { return count[g.id]; });
    }

    function movieItems(genreId, cats) {
        // Met TMDB-gegevens én de volledige filmlijst al binnen: complete indeling (categorieën + TMDB)
        if (Tmdb.hasData('m') && Api.loaded('vs:*')) {
            return indexed('m', genreId, cats).catch(function () { return byCategory(genreId, cats); });
        }
        // Anders meteen de categorieën met dit genre tonen, en de volledige lijst op de achtergrond laden
        if (Tmdb.hasData('m')) Api.vodStreams(null).catch(function () { /* volgende keer opnieuw */ });
        return byCategory(genreId, cats);
    }

    // Licht: alleen de categorieën met dit genre in de naam laden
    function byCategory(genreId, cats) {
        var info = catInfo(cats);
        var ids = Object.keys(info).filter(function (id) { return info[id].ok && info[id].genres.indexOf(genreId) >= 0; });
        return Promise.all(ids.map(function (id) { return Api.vodStreams(id).catch(function () { return []; }); })).then(function (lists) {
            var all = [].concat.apply([], lists);
            return dedupe(all, info).sort(newest('added'));
        });
    }

    // ---- Series: genre per serie + genres uit de categorienaam ----
    // Extra genres op basis van titel + beschrijving (alleen genres met plotRe, en niet als een uitsluitend genre al geldt)
    function byPlot(s, have) {
        var text = U.norm((s.name || '') + ' ' + (s.plot || '')), out = [];
        LIST.forEach(function (g) {
            if (!g.plotRe || have.indexOf(g.id) >= 0) return;
            if ((g.notWith || []).some(function (x) { return have.indexOf(x) >= 0; })) return;
            if (g.plotRe.test(text)) out.push(g.id);
        });
        return out;
    }

    // Index per genre over de volledige lijst. type 'm' = films, 't' = series.
    // Bronnen: genre van de provider (series), categorienaam, TMDB (als bekend), anders trefwoorden in titel/beschrijving.
    function build(type, all, info) {
        var visible = all.filter(function (s) { return App.catIds(s).some(function (id) { return !info[id] || info[id].ok; }); });
        var idx = {};
        dedupe(visible, info).forEach(function (s) {
            var gs = type === 't' ? match(String(s.genre || '').replace(/[,/|]/g, ' , ')) : [];
            App.catIds(s).forEach(function (id) { if (info[id]) gs = gs.concat(info[id].genres); });
            var tg = Tmdb.genres(type, s);
            if (tg) gs = gs.concat(tg);
            else if (type === 't') gs = gs.concat(byPlot(s, gs));
            gs.filter(function (g, i) { return gs.indexOf(g) === i; }).forEach(function (g) { (idx[g] = idx[g] || []).push(s); });
        });
        var field = type === 't' ? 'last_modified' : 'added';
        Object.keys(idx).forEach(function (g) { idx[g].sort(newest(field)); });
        return idx;
    }

    // Opnieuw opbouwen als de lijst (na vernieuwen/6 uur), de talen of de TMDB-gegevens veranderd zijn
    var built = { m: null, t: null };
    function indexed(type, genreId, cats) {
        var info = catInfo(cats), key = JSON.stringify(activeLangs(cats));
        return (type === 't' ? Api.series(null) : Api.vodStreams(null)).then(function (all) {
            var c = built[type], v = Tmdb.version();
            if (!c || c.key !== key || c.src !== all || (c.v !== v && Date.now() - c.at > 60000)) {
                c = built[type] = { idx: build(type, all, info), key: key, src: all, v: v, at: Date.now() };
            }
            return c.idx[genreId] || [];
        });
    }

    function seriesItems(genreId, cats) { return indexed('t', genreId, cats); }

    function reset() { built = { m: null, t: null }; }
    function langName(code) { return LANG_NAMES[code] || code; }

    return {
        LIST: LIST, byId: function (id) { return BY_ID[id]; }, match: match, splitName: splitName,
        langsIn: langsIn, activeLangs: activeLangs, langName: langName,
        movieGenres: movieGenres, movieItems: movieItems, seriesItems: seriesItems, reset: reset,
        // Dubbele titels samenvoegen (voorkeurstaal wint) en alleen gekozen talen; gebruikt door de metadata-service
        best: function (items, cats) {
            var info = catInfo(cats);
            return dedupe(items.filter(function (s) { return App.catIds(s).some(function (id) { return !info[id] || info[id].ok; }); }), info);
        }
    };
})();
