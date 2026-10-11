/* M3U/M3U8-afspeellijsten. Een lijst wordt één keer gedownload en in delen gelezen (ook lijsten van tientallen MB),
   en daarna aangeboden alsof het een Xtream-server is (zelfde antwoorden als player_api.php), zodat alle schermen,
   de gids, zoeken en zenderbeheer gewoon werken.
   - Zenders, films en series: Xtream-achtige adressen (/live/, /movie/, /series/) zeggen wat het is; anders bepalen
     de bestandsextensie (.mp4/.mkv… = film) en "S01E02" in de naam (= aflevering van een serie) het
   - group-title wordt de categorie, tvg-logo het logo, tvg-id het epg-id (voor de XMLTV-gids)
   - x-tvg-url / url-tvg in de kop van de lijst = adres van de XMLTV-gids
   - Bewaard in IndexedDB (6 uur geldig, daarna op de achtergrond vernieuwd) */
var M3U = (function () {
    'use strict';

    var TTL = 6 * 3600e3;
    var VOD_EXT = /\.(mp4|mkv|avi|mov|m4v|wmv|flv|webm|mpg|mpeg)(\?.*)?$/i;
    var EPISODE = /^(.*?)[\s._\-|:]*\bS(\d{1,2})\s*[._\- ]?\s*E(\d{1,4})\b/i;
    var data = null, dataUrl = '', loading = null, bypassBefore = 0;

    // Vaste getallen uit tekst (zodat favorieten en kijkgeschiedenis na een nieuwe download blijven kloppen)
    function hash(s) {
        var h = 2166136261;
        for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return (h >>> 0) % 2000000000 + 1;
    }

    // #EXTINF:-1 tvg-id="x" group-title="A, B",Naam  -> { attrs: {…}, title }  (komma's binnen aanhalingstekens tellen niet)
    function extinf(line) {
        var s = line.slice(line.indexOf(':') + 1), q = false, i;
        for (i = 0; i < s.length; i++) {
            var c = s.charAt(i);
            if (c === '"') q = !q;
            else if (c === ',' && !q) break;
        }
        var head = s.slice(0, i), attrs = {}, m, re = /([\w-]+)\s*=\s*"([^"]*)"/g;
        while ((m = re.exec(head))) attrs[m[1].toLowerCase()] = m[2];
        return { attrs: attrs, title: s.slice(i + 1).trim() };
    }

    // Eén regel verwerken; st = toestand van het lezen
    function line(st, raw) {
        var l = raw.trim();
        if (!l) return;
        if (l.charAt(0) === '#') {
            if (/^#EXTM3U/i.test(l)) {
                var h = extinf('x:' + l.slice(7) + ',');
                st.epg = h.attrs['x-tvg-url'] || h.attrs['url-tvg'] || h.attrs['tvg-url'] || st.epg;
                if (st.epg) st.epg = st.epg.split(',')[0].trim();
            } else if (/^#EXTINF/i.test(l)) st.cur = extinf(l);
            else if (/^#EXTGRP:/i.test(l) && st.cur) st.cur.group = l.slice(8).trim();
            return;
        }
        if (!st.cur) st.cur = { attrs: {}, title: '' };
        add(st, st.cur, l);
        st.cur = null;
    }

    function category(st, kind, name) {
        name = name || T('Overig');
        var key = kind + '|' + name, c = st.cats[key];
        if (!c) {
            c = st.cats[key] = { category_id: String(hash(key)), category_name: name, parent_id: 0 };
            st.out[kind + 'Cats'].push(c);
        }
        return c.category_id;
    }

    function add(st, e, url) {
        var a = e.attrs, name = e.title || a['tvg-name'] || url.split('/').pop(), group = a['group-title'] || e.group || '';
        var logo = a['tvg-logo'] || '', ext = (VOD_EXT.exec(url) || [])[1] || '';
        // Xtream-achtig adres: soort en id staan erin
        var x = /\/(live|movie|series)\/[^/]+\/[^/]+\/(\d+)\.(\w+)(\?.*)?$/i.exec(url);
        var kind = x ? x[1].toLowerCase() : ext ? 'movie' : 'live';
        var ep = kind !== 'live' ? EPISODE.exec(name) : null;
        if (ep && ep[1].trim()) kind = 'series';
        var id = x ? parseInt(x[2], 10) : hash(url);
        if (x && !ext) ext = x[3];
        st.n++;
        if (kind === 'live') {
            st.out.live.push({ num: parseInt(a['tvg-chno'], 10) || st.out.live.length + 1, name: name, stream_type: 'live', stream_id: id,
                stream_icon: logo, category_id: category(st, 'live', group), epg_channel_id: a['tvg-id'] || '', url: url });
        } else if (kind === 'movie') {
            st.out.vod.push({ num: st.out.vod.length + 1, name: name, stream_type: 'movie', stream_id: id, stream_icon: logo,
                category_id: category(st, 'vod', group), container_extension: ext || 'mp4', added: String(st.t0 - st.n), rating: '', url: url });
        } else {
            // Aflevering: bij de serie met dezelfde naam (en categorie) zetten
            var sname = (ep ? ep[1] : name).replace(/[\s\-|:.]+$/, '').trim() || name;
            var cat = category(st, 'series', group), sid = hash('series|' + cat + '|' + sname.toLowerCase());
            var s = st.series[sid];
            if (!s) {
                s = st.series[sid] = { num: st.out.series.length + 1, name: sname, series_id: sid, cover: logo, plot: '', genre: '', rating: '',
                    category_id: cat, last_modified: String(st.t0 - st.n), eps: {} };
                st.out.series.push(s);
            }
            var season = ep ? parseInt(ep[2], 10) : 1, num = ep ? parseInt(ep[3], 10) : 0;
            var list = s.eps[season] = s.eps[season] || [];
            list.push({ id: String(id), episode_num: num || list.length + 1, title: name, container_extension: ext || 'mp4', season: season,
                info: { movie_image: logo }, url: url });
        }
        st.urls[kind + ':' + id] = url;
    }

    // Lijst downloaden en in delen lezen
    function fetchList(url) {
        var st = { cur: null, epg: '', cats: {}, series: {}, urls: {}, n: 0, t0: Math.floor(Date.now() / 1000),
            out: { live: [], vod: [], series: [], liveCats: [], vodCats: [], seriesCats: [] } };
        var ctrl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 5 * 60e3);
        return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
            if (!r.ok) throw new Error(T('Server gaf foutcode {code}', { code: r.status }));
            var dec = new TextDecoder('utf-8'), buf = '';
            var eat = function (final) {
                var lines = buf.split(/\r?\n/);
                buf = final ? '' : lines.pop();
                lines.forEach(function (l) { line(st, l); });
            };
            if (!r.body || !r.body.getReader) return r.text().then(function (t) { buf = t; eat(true); });
            var reader = r.body.getReader();
            var read = function () {
                return reader.read().then(function (x) {
                    if (x.done) { buf += dec.decode(); eat(true); return; }
                    buf += dec.decode(x.value, { stream: true });
                    eat(false);
                    return read();
                });
            };
            return read();
        }, function (e) {
            throw new Error(e && e.name === 'AbortError' ? T('Downloaden duurde te lang') : T('Kan de afspeellijst niet downloaden'));
        }).then(function () {
            clearTimeout(timer);
            if (!st.n) throw new Error(T('Dit lijkt geen M3U-afspeellijst'));
            var o = st.out;
            return { url: url, at: Date.now(), epg: st.epg, live: o.live, vod: o.vod, series: o.series,
                liveCats: o.liveCats, vodCats: o.vodCats, seriesCats: o.seriesCats, urls: st.urls };
        }, function (e) { clearTimeout(timer); throw e; });
    }

    function key(url) { return 'm3u|' + url; }
    // Bewaarde lijst gebruiken (en als hij ouder is dan 6 uur op de achtergrond vernieuwen), anders downloaden
    function load(url) {
        if (data && dataUrl === url) return Promise.resolve(data);
        if (loading && loading.url === url) return loading.p;
        var fresh = function () {
            return fetchList(url).then(function (d) {
                Db.put('lists', key(url), d).catch(function (e) { console.warn('Lijst lokaal bewaren mislukt', e); });
                return d;
            });
        };
        var p = Db.get('lists', key(url)).catch(function () { return null; }).then(function (s) {
            if (!s || !s.live || s.at < bypassBefore) return fresh();
            if (Date.now() - s.at > TTL) fresh().then(function (d) { if (dataUrl === url) data = d; }).catch(function () { /* oude lijst blijft */ });
            return s;
        }).then(function (d) { data = d; dataUrl = url; loading = null; return d; }, function (e) { loading = null; throw e; });
        loading = { url: url, p: p };
        return p;
    }

    function byCat(list, cat) { return cat ? list.filter(function (x) { return String(x.category_id) === String(cat); }) : list; }
    function epgEmpty() { return { epg_listings: [] }; }

    // Antwoorden zoals player_api.php
    function handle(url, p) {
        return load(url).then(function (d) {
            switch (p.action) {
                case 'get_live_categories': return d.liveCats;
                case 'get_live_streams': return byCat(d.live, p.category_id);
                case 'get_vod_categories': return d.vodCats;
                case 'get_vod_streams': return byCat(d.vod, p.category_id);
                case 'get_vod_info':
                    var m = d.vod.filter(function (x) { return String(x.stream_id) === String(p.vod_id); })[0];
                    return { info: { movie_image: m ? m.stream_icon : '' }, movie_data: m || {} };
                case 'get_series_categories': return d.seriesCats;
                case 'get_series': return byCat(d.series, p.category_id).map(function (s) { var c = Object.assign({}, s); delete c.eps; return c; });
                case 'get_series_info':
                    var s = d.series.filter(function (x) { return String(x.series_id) === String(p.series_id); })[0];
                    if (!s) return { info: {}, seasons: [], episodes: {} };
                    var info = Object.assign({}, s); delete info.eps;
                    var nums = Object.keys(s.eps).map(Number).sort(function (a, b) { return a - b; });
                    var eps = {};
                    nums.forEach(function (n) { eps[n] = s.eps[n].slice().sort(function (a, b) { return a.episode_num - b.episode_num; }); });
                    return { info: info, seasons: nums.map(function (n) { return { season_number: n, name: T('Seizoen {n}', { n: n }) }; }), episodes: eps };
                case 'get_short_epg': case 'get_simple_data_table': return epgEmpty();
                default:
                    // "Inloggen": de lijst is gedownload, dus het account werkt
                    return { user_info: { auth: 1, status: 'Active', exp_date: null, max_connections: '', active_cons: '' }, server_info: { url: url } };
            }
        });
    }

    return {
        handle: handle, load: load,
        // Adres van een film, aflevering of zender uit de lijst
        url: function (kind, id) { return data && data.urls[kind + ':' + id] || ''; },
        // XMLTV-adres uit de kop van de lijst
        epgUrl: function () { return data ? data.epg || '' : ''; },
        // Vernieuwen: bewaarde lijst negeren en opnieuw downloaden
        reset: function (force) { data = null; dataUrl = ''; loading = null; if (force) bypassBefore = Date.now(); },
        // Voor tests
        parseText: function (text) {
            var st = { cur: null, epg: '', cats: {}, series: {}, urls: {}, n: 0, t0: 1700000000,
                out: { live: [], vod: [], series: [], liveCats: [], vodCats: [], seriesCats: [] } };
            text.split(/\r?\n/).forEach(function (l) { line(st, l); });
            return { epg: st.epg, live: st.out.live, vod: st.out.vod, series: st.out.series, cats: st.out, urls: st.urls };
        },
        extinf: extinf
    };
})();
