/* TMDB-verrijking: zoekt op de achtergrond per film/serie de basisgegevens op (genre, titel, jaar, speelduur, rating,
   poster, backdrop) via het TMDB-id dat de provider meelevert. Genres gaan naar localStorage (snel, synchroon),
   de overige gegevens naar de metadata-service (IndexedDB). Daarna worden alleen nieuwe titels opgezocht. */
var Tmdb = (function () {
    'use strict';

    var API = 'https://api.themoviedb.org/3/';

    // TMDB-genre-id -> onze genres
    var MOVIE = { 28: ['actie'], 12: ['avontuur'], 16: ['animatie'], 35: ['komedie'], 80: ['misdaad'], 99: ['docu'], 18: ['drama'],
        10751: ['familie'], 14: ['fantasy'], 36: ['oorlog'], 27: ['horror'], 10402: ['muziek'], 9648: ['thriller'], 10749: ['romantiek'],
        878: ['scifi'], 53: ['thriller'], 10752: ['oorlog'], 37: ['western'] };
    var TV = { 10759: ['actie', 'avontuur'], 16: ['animatie'], 35: ['komedie'], 80: ['misdaad'], 99: ['docu'], 18: ['drama'], 10751: ['familie'],
        10762: ['kids'], 9648: ['thriller'], 10763: ['nieuws'], 10764: ['reality'], 10765: ['scifi', 'fantasy'], 10766: ['soap'],
        10767: ['programma'], 10768: ['oorlog'], 37: ['western'] };
    // TMDB kent voor series geen Horror/Romantiek als genre, wel als trefwoord
    var TV_KEYWORDS = [
        { g: 'horror', re: /\b(horror|zombie|vampire|werewolf|slasher|haunted house|haunting|exorcism|demonic possession|undead)\b/ },
        { g: 'romantiek', re: /\b(romance|romantic comedy|love triangle)\b/ }
    ];

    // Vaste één-letter-codes per genre (compact opslaan; volgorde nooit wijzigen)
    var CODE = { actie: 'a', avontuur: 'b', animatie: 'c', kids: 'd', familie: 'e', komedie: 'f', drama: 'g', romantiek: 'h', thriller: 'i',
        misdaad: 'j', horror: 'k', scifi: 'l', fantasy: 'm', oorlog: 'n', western: 'o', docu: 'p', reality: 'q', programma: 'r', soap: 's',
        muziek: 't', nieuws: 'u' };
    var DECODE = {};
    Object.keys(CODE).forEach(function (g) { DECODE[CODE[g]] = g; });
    var NONE = 'z', NOTFOUND = '!';

    var db = { m: null, t: null }, dirty = { m: 0, t: 0 }, version = 0, runId = 0;
    var state = { running: false, done: 0, total: 0, error: '', phase: '' };

    function key() { return String(Store.settings().tmdbKey || (window.CONFIG && CONFIG.tmdbKey) || '').trim(); }
    function enabled() { return !!key(); }

    function load(t) { if (!db[t]) db[t] = Store.getGlobal('tmdb.' + t, {}) || {}; return db[t]; }
    function flush(t) {
        if (!dirty[t]) return;
        dirty[t] = 0;
        version++;
        if (!Store.setGlobal('tmdb.' + t, db[t])) state.error = T('Opslag op de TV is vol');
    }

    function idOf(it) {
        var v = String(it.tmdb || it.tmdb_id || '').trim();
        return /^\d+$/.test(v) && v !== '0' ? v : null;
    }

    // Genres volgens TMDB, of null als (nog) onbekend. type: 'm' (film) of 't' (serie)
    function genres(type, it) {
        if (!enabled()) return null;
        var id = idOf(it);
        if (!id) return null;
        var c = load(type)[id];
        if (c == null || c === NOTFOUND) return null;
        if (c === NONE) return [];
        var out = [];
        for (var i = 0; i < c.length; i++) if (DECODE[c[i]]) out.push(DECODE[c[i]]);
        return out;
    }

    function hasData(type) { return enabled() && Object.keys(load(type)).length > 0; }

    function encode(type, d) {
        var map = type === 't' ? TV : MOVIE, gs = [];
        (d.genres || []).forEach(function (g) { (map[g.id] || []).forEach(function (x) { if (gs.indexOf(x) < 0) gs.push(x); }); });
        if (type === 't') {
            var kw = d.keywords ? (d.keywords.results || d.keywords.keywords || []) : [];
            var text = kw.map(function (k) { return String(k.name || '').toLowerCase(); }).join(' | ');
            TV_KEYWORDS.forEach(function (r) { if (r.re.test(text) && gs.indexOf(r.g) < 0) gs.push(r.g); });
        }
        return gs.length ? gs.map(function (g) { return CODE[g]; }).join('') : NONE;
    }

    // Algemeen TMDB-verzoek. path bv. 'movie/550', query bv. 'language=en-US'. Geeft null bij 404.
    function api(path, query) {
        var ctrl = window.AbortController ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
        var url = API + path + '?api_key=' + encodeURIComponent(key()) + (query ? '&' + query : '');
        return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
            if (r.status === 404) return null;
            if (r.status === 401) { var e = new Error(T('Ongeldige TMDB-sleutel')); e.fatal = true; throw e; }
            if (r.status === 429) { var e2 = new Error(T('Te veel verzoeken')); e2.retry = 10000; throw e2; }
            if (!r.ok) throw new Error(T('TMDB-fout {code}', { code: r.status }));
            return r.json();
        }).then(function (x) { clearTimeout(timer); return x; }, function (e) { clearTimeout(timer); throw e; });
    }

    // Eén titel: genrecode teruggeven en basisgegevens in de metadata-service zetten
    function lookup(type, id) {
        return api((type === 't' ? 'tv/' : 'movie/') + id, 'language=' + I18N.tmdb() + '&append_to_response=keywords').then(function (d) {
            if (!d) { Meta.put(type, id, Meta.MISSING); return NOTFOUND; }
            Meta.put(type, id, Meta.fromTmdb(type, d));
            return encode(type, d);
        });
    }

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    // Werkt een wachtrij af met een paar parallelle "werkers"; rustiger tijdens het kijken
    function work(type, queue, my) {
        var d = load(type), sinceFlush = 0, retries = {};
        function worker() {
            if (!state.running || my !== runId || !queue.length) return Promise.resolve();
            var id = queue.shift();
            return lookup(type, id).then(function (code) {
                d[id] = code;
                dirty[type] = 1;
                state.done++;
                if (++sinceFlush >= 200) { sinceFlush = 0; flush(type); }
            }).catch(function (e) {
                if (e.fatal) { state.error = e.message; if (my === runId) state.running = false; return; }
                retries[id] = (retries[id] || 0) + 1;
                if (retries[id] <= 2) queue.push(id); else state.done++;
                if (e.retry) return sleep(e.retry);
            }).then(function () {
                // ±20-30 per seconde; tijdens het kijken ±6 per seconde (TMDB staat ±40 per seconde toe)
                return sleep(Player.state() === 'playing' ? 600 : 120);
            }).then(worker);
        }
        var workers = [];
        for (var i = 0; i < 6; i++) workers.push(worker());
        return Promise.all(workers).then(function () { flush(type); });
    }

    // Wachtrij van TMDB-id's waarvan genre of basisgegevens nog ontbreken
    function pending(type, list) {
        var d = load(type), seen = {}, q = [], known = 0;
        list.forEach(function (it) {
            var id = idOf(it);
            if (!id || seen[id]) return;
            seen[id] = 1;
            // Ook opnieuw ophalen als de titel in een andere taal is opgeslagen (na het wisselen van taal)
            if (d[id] == null || !Meta.has(type, id) || Meta.langOf(type, id) !== I18N.lang()) q.push(id); else known++;
        });
        return { q: q, known: known };
    }

    // Start het bijwerken: eerst series, dan films. Veilig om vaker aan te roepen.
    function start() {
        if (!enabled() || state.running) return;
        var my = ++runId;
        state.running = true;
        state.error = '';
        state.phase = 'series';
        Meta.ready().then(function () { return Api.series(null); }).catch(function () { return []; }).then(function (series) {
            var s = pending('t', series);
            state.done = s.known;
            state.total = s.known + s.q.length;
            return work('t', s.q, my);
        }).then(function () {
            if (!state.running || my !== runId) return;
            state.phase = 'films';
            return Api.vodStreams(null).catch(function () { return []; }).then(function (movies) {
                var m = pending('m', movies);
                state.done += m.known;
                state.total += m.known + m.q.length;
                return work('m', m.q, my);
            });
        }).catch(function (e) { state.error = e.message; }).then(function () {
            if (my !== runId) return;
            state.running = false;
            state.phase = state.error ? '' : 'klaar';
            flush('t'); flush('m');
            Meta.flush();
        });
    }

    function stop() { runId++; state.running = false; }
    // Genres van deze titels vergeten (verlopen volgens de bewaartermijn), zodat ze opnieuw worden opgezocht
    function forget(type, ids) {
        var d = load(type), n = 0;
        ids.forEach(function (id) { if (id in d) { delete d[id]; n++; } });
        if (n) { dirty[type] = 1; flush(type); }
    }
    function clear() { stop(); db = { m: {}, t: {} }; dirty = { m: 1, t: 1 }; flush('m'); flush('t'); Meta.clear(); state.done = 0; state.total = 0; state.phase = ''; }

    function status() {
        if (!enabled()) return T('Uit: druk op OK om een sleutel in te voeren');
        if (state.error) return T('Fout: {error}', { error: state.error });
        var pct = state.total ? Math.floor(state.done / state.total * 100) : 0;
        var n = I18N.num(state.done) + ' / ' + I18N.num(state.total);
        if (state.running) return state.phase === 'films' ? T('Bezig met films: {pct}% ({n})', { pct: pct, n: n }) : T('Bezig met series: {pct}% ({n})', { pct: pct, n: n });
        if (state.phase === 'klaar') return T('Bijgewerkt: {n} titels', { n: I18N.num(state.total) });
        var known = Object.keys(load('t')).length + Object.keys(load('m')).length;
        return known ? T('{n} titels bekend', { n: I18N.num(known) }) : T('Nog niet gestart');
    }

    return {
        enabled: enabled, genres: genres, hasData: hasData, start: start, stop: stop, clear: clear, api: api, idOf: idOf, forget: forget,
        status: status, running: function () { return state.running; }, version: function () { return version; }
    };
})();
