/* Metadata-service: één laag tussen de app en de metadatabron (nu TMDB).
   - Basisgegevens per titel (compact) in het geheugen + IndexedDB, gevuld door de achtergrondtaak in tmdb.js
   - Details per titel (beschrijving, cast, trailer, aanbevelingen) en personen: pas bij openen opgehaald en bewaard
   - Koppeling TMDB-id -> titel in jouw IPTV-bibliotheek
   Een andere bron gebruiken = alleen fromTmdb/details/person hieronder vervangen. */
var Meta = (function () {
    'use strict';

    var IMG = 'https://image.tmdb.org/t/p/';
    var MISSING = 0;           // TMDB kent deze titel niet
    var FRESH = 30 * 86400e3;  // details/personen na 30 dagen opnieuw ophalen

    // Compacte opslag per titel (array, scheelt geheugen bij ±70.000 titels). Volgorde nooit wijzigen.
    var F = { title: 0, otitle: 1, year: 2, runtime: 3, rating: 4, votes: 5, pop: 6, lang: 7, countries: 8, poster: 9, backdrop: 10, seasons: 11, status: 12 };

    var mem = null, readyP = null, queue = [], flushT = null, persist = true;

    function k(type, id) { return type + ':' + id; }

    // Basisgegevens uit IndexedDB laden (één keer per start)
    function ready() {
        if (!readyP) {
            readyP = Db.all('titles').then(function (r) {
                mem = new Map();
                r.keys.forEach(function (key, i) { mem.set(key, r.values[i]); });
            }).catch(function (e) {
                console.warn('Metadata: geen IndexedDB, alleen in geheugen', e);
                persist = false;
                mem = new Map();
            });
        }
        return readyP;
    }

    function has(type, id) { return !!(mem && mem.has(k(type, id))); }

    function put(type, id, rec) {
        if (!mem) mem = new Map();
        mem.set(k(type, id), rec);
        queue.push([k(type, id), rec]);
        if (queue.length >= 200) flush();
        else if (!flushT) flushT = setTimeout(flush, 5000);
    }
    function flush() {
        clearTimeout(flushT);
        flushT = null;
        var batch = queue;
        queue = [];
        if (persist && batch.length) Db.putMany('titles', batch).catch(function (e) { console.warn('Metadata opslaan mislukt', e); });
    }
    function clear() {
        if (mem) mem.clear();
        queue = [];
        if (persist) { Db.clear('titles').catch(function () {}); Db.clear('details').catch(function () {}); }
    }

    // TMDB-antwoord -> compact record
    function fromTmdb(type, d) {
        var tv = type === 't', date = (tv ? d.first_air_date : d.release_date) || '';
        var countries = tv ? (d.origin_country || []) : (d.production_countries || []).map(function (c) { return c.iso_3166_1; });
        return [
            (tv ? d.name : d.title) || '', (tv ? d.original_name : d.original_title) || '',
            parseInt(date.slice(0, 4), 10) || 0,
            tv ? ((d.episode_run_time || [])[0] || 0) : (d.runtime || 0),
            Math.round((d.vote_average || 0) * 10), d.vote_count || 0, Math.round(d.popularity || 0),
            d.original_language || '', countries.join(','), d.poster_path || '', d.backdrop_path || '',
            tv ? (d.number_of_seasons || 0) : 0, tv ? (d.status || '') : ''
        ];
    }

    // Basisgegevens voor een IPTV-item (film/serie van de provider), of null
    function info(type, item) {
        var id = Tmdb.idOf(item || {});
        return id ? byId(type, id) : null;
    }
    function byId(type, id) {
        var r = mem && mem.get(k(type, id));
        if (!r) return null;
        return {
            id: String(id), type: type, title: r[F.title], otitle: r[F.otitle], year: r[F.year], runtime: r[F.runtime],
            rating: r[F.rating] / 10, votes: r[F.votes], pop: r[F.pop], lang: r[F.lang],
            countries: r[F.countries] ? r[F.countries].split(',') : [], poster: r[F.poster], backdrop: r[F.backdrop],
            seasons: r[F.seasons], status: r[F.status]
        };
    }

    function img(path, size) { return path ? IMG + (size || 'w342') + path : ''; }

    // Rating die we tonen: TMDB als er genoeg stemmen zijn, anders die van de provider
    function rating(type, item) {
        var m = info(type, item);
        if (m && m.votes >= 20 && m.rating) return m.rating;
        var r = parseFloat(item && item.rating);
        return r > 0 ? (r > 10 ? r / 10 : r) : 0;
    }
    function poster(type, item, providerIcon) {
        if (providerIcon) return providerIcon;
        var m = info(type, item);
        return m && m.poster ? img(m.poster, 'w342') : '';
    }

    // ---- Details per titel (bij openen) ----
    function details(type, id) {
        if (!id || !Tmdb.enabled()) return Promise.resolve(null);
        var key = k(type, id);
        return Db.get('details', key).catch(function () { return null; }).then(function (cached) {
            if (cached && Date.now() - cached.at < FRESH) return cached;
            var path = (type === 't' ? 'tv/' : 'movie/') + id;
            return Tmdb.api(path, 'language=nl-NL&append_to_response=credits,videos,recommendations&include_video_language=nl,en,null').then(function (d) {
                if (!d) return null;
                put(type, id, fromTmdb(type, d));
                var det = {
                    at: Date.now(), overview: d.overview || '', tagline: d.tagline || '',
                    genres: (d.genres || []).map(function (g) { return g.name; }),
                    cast: ((d.credits && d.credits.cast) || []).slice(0, 15).map(function (c) { return { id: c.id, name: c.name, role: c.character || '', img: c.profile_path || '' }; }),
                    crew: crewOf(type, d),
                    trailer: trailerOf(d.videos),
                    recs: ((d.recommendations && d.recommendations.results) || []).map(function (x) { return x.id; })
                };
                // Geen Nederlandse beschrijving? Dan de Engelse
                var en = det.overview ? Promise.resolve(null) : Tmdb.api(path, 'language=en-US').catch(function () { return null; });
                return en.then(function (e) {
                    if (e && e.overview) det.overview = e.overview;
                    if (e && !det.tagline) det.tagline = e.tagline || '';
                    Db.put('details', key, det).catch(function () {});
                    return det;
                });
            }).catch(function (e) { console.warn('Details ophalen mislukt', e); return cached || null; });
        });
    }

    function crewOf(type, d) {
        var out = [];
        (d.created_by || []).forEach(function (c) { out.push({ id: c.id, name: c.name, role: 'Bedenker', img: c.profile_path || '' }); });
        ((d.credits && d.credits.crew) || []).forEach(function (c) {
            if (c.job === 'Director' && !out.some(function (x) { return x.id === c.id; })) out.push({ id: c.id, name: c.name, role: 'Regie', img: c.profile_path || '' });
        });
        return out.slice(0, 6);
    }

    function trailerOf(videos) {
        var list = (videos && videos.results) || [];
        var t = list.filter(function (v) { return v.site === 'YouTube' && v.type === 'Trailer'; })[0] || list.filter(function (v) { return v.site === 'YouTube'; })[0];
        return t ? t.key : '';
    }

    // ---- Personen (bij openen) ----
    function person(id) {
        var key = 'p:' + id;
        return Db.get('people', key).catch(function () { return null; }).then(function (cached) {
            if (cached && Date.now() - cached.at < FRESH) return cached;
            return Tmdb.api('person/' + id, 'language=nl-NL&append_to_response=combined_credits').then(function (d) {
                if (!d) return null;
                var cc = d.combined_credits || {}, seen = {}, credits = [];
                (cc.cast || []).concat((cc.crew || []).filter(function (c) { return c.department === 'Directing' || c.job === 'Creator'; })).forEach(function (c) {
                    var t = c.media_type === 'tv' ? 't' : c.media_type === 'movie' ? 'm' : null, key2 = t + c.id;
                    if (!t || seen[key2]) return;
                    seen[key2] = 1;
                    var job = c.job === 'Director' ? 'Regie' : c.job === 'Creator' ? 'Bedenker' : c.job;
                    credits.push({ t: t, id: c.id, role: c.character || job || '', pop: c.popularity || 0 });
                });
                var p = { at: Date.now(), id: d.id, name: d.name, img: d.profile_path || '', dept: d.known_for_department || '', bio: d.biography || '',
                    born: d.birthday || '', credits: credits };
                var en = p.bio ? Promise.resolve(null) : Tmdb.api('person/' + id, 'language=en-US').catch(function () { return null; });
                return en.then(function (e) {
                    if (e && e.biography) p.bio = e.biography;
                    Db.put('people', key, p).catch(function () {});
                    return p;
                });
            }).catch(function (e) { console.warn('Persoon ophalen mislukt', e); return cached || null; });
        });
    }

    // ---- Jouw bibliotheek: TMDB-id -> IPTV-item (dubbelen al samengevoegd, voorkeurstaal wint) ----
    var lib = { src: null, map: null, p: null };
    function library() {
        // Lijsten zonder dubbelen komen uit de genre-index (in stukjes opgebouwd, dus de TV blijft reageren)
        var p = Promise.all([Api.vodCategories(), Api.seriesCategories()]).then(function (c) {
            return Promise.all([Genres.all('m', c[0]), Genres.all('t', c[1])]);
        });
        return p.then(function (r) {
            if (lib.src && lib.src[0] === r[0] && lib.src[1] === r[1]) return lib.map;
            if (lib.p && lib.p.src[0] === r[0] && lib.p.src[1] === r[1]) return lib.p;
            var map = { m: new Map(), t: new Map() };
            var job = U.each(r[0], function (it) { var id = Tmdb.idOf(it); if (id) map.m.set(id, it); }, 5000)
                .then(function () { return U.each(r[1], function (it) { var id = Tmdb.idOf(it); if (id) map.t.set(id, it); }, 5000); })
                .then(function () { lib.src = [r[0], r[1]]; lib.map = map; lib.p = null; return map; });
            job.src = [r[0], r[1]];
            lib.p = job;
            return job;
        });
    }
    // Welke van deze TMDB-titels heb jij? items: [{t:'m'|'t', id}] -> [{type, item}]
    function inLibrary(items) {
        return library().then(function (map) {
            var out = [];
            items.forEach(function (x) {
                var it = map[x.t] && map[x.t].get(String(x.id));
                if (it) out.push({ type: x.t, item: it, role: x.role || '' });
            });
            return out;
        });
    }

    function count() { return mem ? mem.size : 0; }

    return {
        MISSING: MISSING, ready: ready, has: has, put: put, flush: flush, clear: clear, fromTmdb: fromTmdb,
        info: info, byId: byId, img: img, rating: rating, poster: poster, details: details, person: person,
        library: library, inLibrary: inLibrary, count: count, persistent: function () { return persist; }
    };
})();
