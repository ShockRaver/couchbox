/* Client voor de IPTV-provider: Xtream-API (player_api.php), M3U-afspeellijst (via M3U, zelfde antwoorden) of de demo */
var Api = (function () {
    'use strict';

    var prof = null, base = '', cache = {}, account = null, mode = 'xtream';   // mode: 'xtream' | 'm3u' | 'demo'

    // "voorbeeld.com:8080/" of ".../player_api.php?..." -> "http://voorbeeld.com:8080"
    function normalizeServer(url) {
        url = String(url || '').trim();
        if (!url) return '';
        if (url.toLowerCase() === 'demo') return 'demo';
        if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
        url = url.replace(/\/(player_api\.php|get\.php|panel_api\.php|xmltv\.php).*$/i, '');
        return url.replace(/\/+$/, '');
    }

    // Wat de gebruiker invulde herkennen: 'demo', een Xtream-server (+ gebruiker/wachtwoord), een Xtream-link met
    // gebruiker en wachtwoord erin (get.php/player_api.php?username=…&password=…), of een M3U-afspeellijst.
    // Geeft { type: 'demo' | 'xtream' | 'm3u', server, username, password, url } of { error }
    function parseLink(text, user, pass) {
        var t = String(text || '').trim();
        if (!t) return { error: T('Vul de server-URL in') };
        if (t.toLowerCase() === 'demo') return { type: 'demo', server: 'demo', username: '', password: '' };
        if (!/^https?:\/\//i.test(t)) t = 'http://' + t;
        var q = {}, qi = t.indexOf('?');
        if (qi >= 0) t.slice(qi + 1).split('&').forEach(function (kv) {
            var i = kv.indexOf('='); if (i > 0) { try { q[kv.slice(0, i).toLowerCase()] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) { /* ongeldig teken */ } }
        });
        var path = t.replace(/^https?:\/\/[^/]+/i, '').split('?')[0];
        // Xtream-link: gebruikersnaam en wachtwoord staan in het adres
        if (/\/(get|player_api|panel_api|xmltv)\.php$/i.test(path) && q.username && q.password) {
            return { type: 'xtream', server: normalizeServer(t), username: q.username, password: q.password };
        }
        // Alleen een server (met poort): gebruikersnaam en wachtwoord nodig
        if (!path || path === '/' || /\/(get|player_api|panel_api)\.php$/i.test(path)) {
            if (!user || !pass) return { error: T('Vul gebruikersnaam en wachtwoord in, of een afspeellijst-link (M3U)') };
            return { type: 'xtream', server: normalizeServer(t), username: user, password: pass };
        }
        // Al het andere is een afspeellijst
        return { type: 'm3u', url: t, server: t, username: '', password: '' };
    }

    function setProfile(p) {
        prof = p || null; cache = {}; account = null;
        mode = !p ? 'xtream' : p.type === 'm3u' ? 'm3u' : normalizeServer(p.server) === 'demo' ? 'demo' : 'xtream';
        base = !p ? '' : mode === 'm3u' ? '' : normalizeServer(p.server);
        M3U.reset();
    }
    function isDemo() { return mode === 'demo'; }
    function isM3u() { return mode === 'm3u'; }
    function enc(s) { return encodeURIComponent(s || ''); }

    function request(params, timeout) {
        if (!prof) return Promise.reject(new Error(T('Geen profiel ingesteld')));
        if (isDemo()) return Demo.handle(params || {});
        if (isM3u()) return M3U.handle(prof.url, params || {});
        var qs = 'username=' + enc(prof.username) + '&password=' + enc(prof.password);
        Object.keys(params || {}).forEach(function (k) { if (params[k] != null) qs += '&' + k + '=' + enc(String(params[k])); });
        var ctrl = window.AbortController ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeout || 30000);
        return fetch(base + '/player_api.php?' + qs, ctrl ? { signal: ctrl.signal } : {})
            .then(function (r) {
                if (!r.ok) throw new Error(T('Server gaf foutcode {code}', { code: r.status }));
                return r.text();
            })
            .then(function (t) {
                try { return t ? JSON.parse(t) : null; } catch (e) { throw new Error(T('Ongeldig antwoord van de server')); }
            })
            .catch(function (e) {
                if (e && e.name === 'AbortError') throw new Error(T('Time-out: de server reageert niet'));
                if (e instanceof TypeError) throw new Error(T('Kan de server niet bereiken'));
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
            p = (STORED[key] && mode === 'xtream' ? fromStore(key, net) : net())
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
            if (!res || !res.user_info) throw new Error(T('Onverwacht antwoord – klopt het serveradres?'));
            var ui = res.user_info;
            if (String(ui.auth) === '0') throw new Error(T('Onjuiste gebruikersnaam of wachtwoord'));
            if (ui.status && ui.status !== 'Active') throw new Error(T('Account is niet actief ({status})', { status: ui.status }));
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
    // Volledige gids van één zender (meerdere dagen vooruit)
    function fullEpg(id) { return request({ action: 'get_simple_data_table', stream_id: id }, 20000); }

    // Volledige XMLTV-gids van de provider (voor de tv-gids; in de demo een nagemaakte gids)
    function xmltvUrl() {
        if (!prof) return '';
        if (isDemo()) return 'demo:xmltv';
        if (isM3u()) return M3U.epgUrl();
        return base + '/xmltv.php?username=' + enc(prof.username) + '&password=' + enc(prof.password);
    }

    // ---- Stream-URL's ----
    function path(kind, id, ext) {
        return base + '/' + kind + '/' + enc(prof.username) + '/' + enc(prof.password) + '/' + id + '.' + ext;
    }
    // Streamformaat per zender: wat eerder werkte (onthouden), anders de instelling Live-streamformaat
    function liveFormat(ch) {
        var m = Store.getP('liveFmt', null) || {};
        return m[ch.stream_id] || (Store.settings().liveFormat === 'ts' ? 'ts' : 'm3u8');
    }
    function liveUrl(ch) {
        if (isDemo()) return Demo.src(ch.stream_id);
        if (isM3u()) {
            var u = ch.url || M3U.url('live', ch.stream_id), f = (Store.getP('liveFmt', null) || {})[ch.stream_id];
            return f ? swapFormat(u, f) : u;
        }
        return path('live', ch.stream_id, liveFormat(ch));
    }
    // .m3u8 <-> .ts in een adres (alleen als het adres zo eindigt)
    function swapFormat(u, to) { return String(u).replace(/\.(m3u8|ts)(\?.*)?$/i, function (m, e, q) { return '.' + (to || (e.toLowerCase() === 'ts' ? 'm3u8' : 'ts')) + (q || ''); }); }
    // Opties om een live-zender af te spelen: met het andere formaat als reserve, en onthouden wat werkt
    function liveOpts(ch, extra) {
        var url = liveUrl(ch), alt = isDemo() ? '' : swapFormat(url);
        return Object.assign({
            live: true, meta: ch, uhd: /4k|uhd/i.test(ch.name || ''), alt: alt !== url ? alt : '',
            onAlt: function (u) {
                var m = Object.assign({}, Store.getP('liveFmt', null) || {});
                m[ch.stream_id] = /\.ts(\?|$)/i.test(u) ? 'ts' : 'm3u8';
                Store.setP('liveFmt', m);
            }
        }, extra || {});
    }
    function movieUrl(item) { return isDemo() ? Demo.src(item.id) : isM3u() ? M3U.url('movie', item.id) : path('movie', item.id, item.ext || 'mp4'); }
    function episodeUrl(item) { return isDemo() ? Demo.src(item.id) : isM3u() ? M3U.url('series', item.id) : path('series', item.id, item.ext || 'mp4'); }

    // Vernieuwen: ook de lokaal bewaarde lijsten negeren, alles opnieuw bij de provider ophalen
    function clearCache() { cache = {}; bypassBefore = Date.now(); M3U.reset(true); }

    return {
        normalizeServer: normalizeServer, parseLink: parseLink, setProfile: setProfile, isDemo: isDemo, isM3u: isM3u, login: login,
        account: function () { return account; }, profile: function () { return prof; },
        liveCategories: liveCategories, liveStreams: liveStreams,
        vodCategories: vodCategories, vodStreams: vodStreams, vodInfo: vodInfo,
        seriesCategories: seriesCategories, series: series, seriesInfo: seriesInfo, shortEpg: shortEpg, fullEpg: fullEpg, xmltvUrl: xmltvUrl,
        loaded: loaded, liveUrl: liveUrl, liveOpts: liveOpts, swapFormat: swapFormat, movieUrl: movieUrl, episodeUrl: episodeUrl, clearCache: clearCache
    };
})();
