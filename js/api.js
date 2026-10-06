/* Xtream Codes API-client */
var Api = (function () {
    'use strict';

    var prof = null, base = '', cache = {}, account = null;

    // "voorbeeld.com:8080/" of ".../player_api.php?..." -> "http://voorbeeld.com:8080"
    function normalizeServer(url) {
        url = String(url || '').trim();
        if (!url) return '';
        if (url.toLowerCase() === 'demo') return 'demo';
        if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
        url = url.replace(/\/(player_api\.php|get\.php|panel_api\.php|xmltv\.php).*$/i, '');
        return url.replace(/\/+$/, '');
    }

    function setProfile(p) { prof = p || null; base = p ? normalizeServer(p.server) : ''; cache = {}; account = null; }
    function isDemo() { return base === 'demo'; }
    function enc(s) { return encodeURIComponent(s || ''); }

    function request(params, timeout) {
        if (!prof) return Promise.reject(new Error('Geen profiel ingesteld'));
        if (isDemo()) return Demo.handle(params || {});
        var qs = 'username=' + enc(prof.username) + '&password=' + enc(prof.password);
        Object.keys(params || {}).forEach(function (k) { if (params[k] != null) qs += '&' + k + '=' + enc(String(params[k])); });
        var ctrl = window.AbortController ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeout || 30000);
        return fetch(base + '/player_api.php?' + qs, ctrl ? { signal: ctrl.signal } : {})
            .then(function (r) {
                if (!r.ok) throw new Error('Server gaf foutcode ' + r.status);
                return r.text();
            })
            .then(function (t) {
                try { return t ? JSON.parse(t) : null; } catch (e) { throw new Error('Ongeldig antwoord van de server'); }
            })
            .catch(function (e) {
                if (e && e.name === 'AbortError') throw new Error('Time-out: de server reageert niet');
                if (e instanceof TypeError) throw new Error('Kan de server niet bereiken');
                throw e;
            })
            .finally(function () { clearTimeout(timer); });
    }

    // Resultaat in het geheugen bewaren, maximaal 6 uur (daarna opnieuw ophalen, zodat nieuwe titels verschijnen);
    // bij een fout niet cachen
    var TTL = 6 * 3600e3;
    function hit(key) {
        var c = cache[key];
        if (c && Date.now() - c.at < TTL) return c.p;
        delete cache[key];
        return null;
    }
    function cached(key, params, map, timeout) {
        var p = hit(key);
        if (!p) {
            var entry = { at: Date.now(), done: false };
            var net = function () { return request(params, timeout).then(map || function (x) { return x; }); };
            p = (STORED[key] && !isDemo() ? fromStore(key, net) : net())
                .then(function (x) { entry.done = true; return x; })
                .catch(function (e) { if (cache[key] === entry) delete cache[key]; throw e; });
            entry.p = p;
            cache[key] = entry;
        }
        return p;
    }

    // Grote lijsten (alle zenders/films/series) ook lokaal bewaren: na een herstart direct beschikbaar.
    // Is de bewaarde lijst ouder dan 6 uur, dan wordt hij op de achtergrond ververst (volgende keer zichtbaar).
    var STORED = { 'ls': 1, 'vs:*': 1, 'ss:*': 1 }, bypassBefore = 0;
    function storeKey(key) { return base + '|' + (prof ? prof.username : '') + '|' + key; }
    function save(key, list) {
        Db.put('lists', storeKey(key), { at: Date.now(), list: list }).catch(function (e) { console.warn('Lijst lokaal bewaren mislukt', e); });
    }
    function fromStore(key, net) {
        var fresh = function () { return net().then(function (x) { save(key, x); return x; }); };
        return Db.get('lists', storeKey(key)).catch(function () { return null; }).then(function (s) {
            if (!s || !s.list || !s.list.length || s.at < bypassBefore) return fresh();
            if (Date.now() - s.at > TTL) {
                var sk = storeKey(key);
                fresh().then(function (x) {
                    // Alleen vervangen als er intussen niet van profiel is gewisseld
                    if (storeKey(key) === sk) cache[key] = { at: Date.now(), done: true, p: Promise.resolve(x) };
                }).catch(function () { /* oude lijst blijft staan */ });
            }
            return s.list;
        });
    }
    // Is deze lijst al volledig binnen (en nog geldig)?
    function loaded(key) { return !!(hit(key) && cache[key].done); }

    // Volledige lijsten (alle films/series/zenders) kunnen bij grote providers lang duren om op te bouwen
    var BIG = 180000;

    function login() {
        return request({}, 20000).then(function (res) {
            if (!res || !res.user_info) throw new Error('Onverwacht antwoord – is dit een Xtream Codes-server?');
            var ui = res.user_info;
            if (String(ui.auth) === '0') throw new Error('Onjuiste gebruikersnaam of wachtwoord');
            if (ui.status && ui.status !== 'Active') throw new Error('Account is niet actief (' + ui.status + ')');
            account = res;
            return res;
        });
    }

    function byNum(list) {
        return list.slice().sort(function (a, b) { return (parseInt(a.num, 10) || 1e9) - (parseInt(b.num, 10) || 1e9); });
    }
    function inCat(cat) { return function (x) { return String(x.category_id) === String(cat); }; }

    function liveCategories() { return cached('lc', { action: 'get_live_categories' }, U.toArr); }
    function liveStreams() { return cached('ls', { action: 'get_live_streams' }, function (x) { return byNum(U.toArr(x)); }, BIG); }

    function vodCategories() { return cached('vc', { action: 'get_vod_categories' }, U.toArr); }
    function vodStreams(cat) {
        if (cat && loaded('vs:*')) return hit('vs:*').then(function (all) { return all.filter(inCat(cat)); });
        return cached('vs:' + (cat || '*'), cat ? { action: 'get_vod_streams', category_id: cat } : { action: 'get_vod_streams' }, U.toArr, cat ? null : BIG);
    }
    function vodInfo(id) { return cached('vi:' + id, { action: 'get_vod_info', vod_id: id }); }

    function seriesCategories() { return cached('sc', { action: 'get_series_categories' }, U.toArr); }
    function series(cat) {
        if (cat && loaded('ss:*')) return hit('ss:*').then(function (all) { return all.filter(inCat(cat)); });
        return cached('ss:' + (cat || '*'), cat ? { action: 'get_series', category_id: cat } : { action: 'get_series' }, U.toArr, cat ? null : BIG);
    }
    function seriesInfo(id) { return cached('si:' + id, { action: 'get_series_info', series_id: id }); }

    function shortEpg(id, limit) { return request({ action: 'get_short_epg', stream_id: id, limit: limit || 4 }, 15000); }
    // Volledige gids van één zender (meerdere dagen, incl. has_archive voor terugkijken)
    function fullEpg(id) { return request({ action: 'get_simple_data_table', stream_id: id }, 20000); }

    // ---- Stream-URL's ----
    function path(kind, id, ext) {
        return base + '/' + kind + '/' + enc(prof.username) + '/' + enc(prof.password) + '/' + id + '.' + ext;
    }
    function liveUrl(ch) {
        if (isDemo()) return Demo.src(ch.stream_id);
        return path('live', ch.stream_id, Store.settings().liveFormat === 'ts' ? 'ts' : 'm3u8');
    }
    function movieUrl(item) { return isDemo() ? Demo.src(item.id) : path('movie', item.id, item.ext || 'mp4'); }
    function episodeUrl(item) { return isDemo() ? Demo.src(item.id) : path('series', item.id, item.ext || 'mp4'); }

    // Vernieuwen: ook de lokaal bewaarde lijsten negeren, alles opnieuw bij de provider ophalen
    // ---- Terugkijken (Xtream "timeshift") ----
    // Starttijd als JJJJ-MM-DD:UU-MM in de tijdzone van de server (die staat in server_info), anders lokale tijd
    function serverTime(t) {
        var tz = account && account.server_info && account.server_info.timezone, v = null;
        try {
            if (tz && window.Intl) {
                v = {};
                new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
                    .formatToParts(new Date(t)).forEach(function (p) { v[p.type] = p.value; });
            }
        } catch (e) { v = null; }
        if (!v || !v.year) {
            var d = new Date(t);
            v = { year: d.getFullYear(), month: U.pad(d.getMonth() + 1), day: U.pad(d.getDate()), hour: U.pad(d.getHours()), minute: U.pad(d.getMinutes()) };
        }
        return v.year + '-' + v.month + '-' + v.day + ':' + (v.hour === '24' ? '00' : v.hour) + '-' + v.minute;
    }
    // "2026-10-06 20:30:00" + offset (ms) -> "2026-10-06:20-30" (rekenen zonder tijdzone: het is al servertijd)
    function shiftStr(str, offset) {
        var m = String(str).match(/^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/);
        if (!m) return '';
        var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + (offset || 0));
        return d.getUTCFullYear() + '-' + U.pad(d.getUTCMonth() + 1) + '-' + U.pad(d.getUTCDate()) + ':' + U.pad(d.getUTCHours()) + '-' + U.pad(d.getUTCMinutes());
    }
    var ARC_FORMATS = ['ts', 'm3u8', 'php'];
    // Opname van een zender: alle varianten die Xtream-providers gebruiken, de laatst werkende eerst.
    // prog: { start, startStr }; offset: ms na de start; minutes: hoe lang
    function archiveUrls(ch, prog, offset, minutes) {
        if (isDemo()) return [{ url: Demo.src(ch.stream_id), fmt: 'ts' }];
        var dur = Math.max(1, Math.ceil(minutes)), u = enc(prof.username), pw = enc(prof.password);
        var times = [shiftStr(prog.startStr, offset), serverTime(prog.start + offset)].filter(function (t, i, a) { return t && a.indexOf(t) === i; });
        var pref = Store.getP('arcFmt', ''), fmts = ARC_FORMATS.slice().sort(function (a, b) { return (b === pref) - (a === pref); });
        var out = [];
        times.forEach(function (t) {
            fmts.forEach(function (f) {
                var url = f === 'php'
                    ? base + '/streaming/timeshift.php?username=' + u + '&password=' + pw + '&stream=' + ch.stream_id + '&start=' + t + '&duration=' + dur
                    : base + '/timeshift/' + u + '/' + pw + '/' + dur + '/' + t + '/' + ch.stream_id + '.' + f;
                out.push({ url: url, fmt: f });
            });
        });
        return out;
    }

    function clearCache() { cache = {}; bypassBefore = Date.now(); }

    return {
        normalizeServer: normalizeServer, setProfile: setProfile, isDemo: isDemo, login: login,
        account: function () { return account; }, profile: function () { return prof; },
        liveCategories: liveCategories, liveStreams: liveStreams,
        vodCategories: vodCategories, vodStreams: vodStreams, vodInfo: vodInfo,
        seriesCategories: seriesCategories, series: series, seriesInfo: seriesInfo, shortEpg: shortEpg, fullEpg: fullEpg,
        loaded: loaded, liveUrl: liveUrl, archiveUrls: archiveUrls, serverTime: serverTime, movieUrl: movieUrl, episodeUrl: episodeUrl, clearCache: clearCache
    };
})();
