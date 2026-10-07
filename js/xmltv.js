/* Tv-gids uit een XMLTV-bestand: de volledige gids van de provider (xmltv.php) of een eigen adres.
   - Eén download (ook .gz), in stukjes gelezen en verwerkt, zodat ook bestanden van honderden MB passen
   - Alleen zenders die je hebt worden bewaard (op epg-id van de provider, anders op zendernaam; geen 18+), 4 uur terug tot 3 dagen vooruit
   - Opgeslagen in IndexedDB; de EPG-module leest per zender, en valt terug op de provider als er niets is
   - Koppeling per zender met de hand aan te passen (TV-gids: OK ingedrukt houden)
   Bron per profiel: Store.getP('epgSrc') = { mode: 'api' | 'xmltv' | 'url', url } */
var Xmltv = (function () {
    'use strict';

    var STORE = 'epg', META = '__meta';
    var BACK = 4 * 3600e3, AHEAD = 3 * 86400e3, MAX_AGE = 12 * 3600e3, DESC = 300;
    var meta = null, metaP = null, idx = null, running = null, progress = null, lastError = '';

    // ---- Bron ----
    function source() { return Store.getP('epgSrc', null) || { mode: 'api' }; }
    function setSource(src) { Store.setP('epgSrc', src); reset(); }
    function url() {
        var s = source();
        if (s.mode === 'xmltv') return Api.xmltvUrl();
        if (s.mode === 'url') return s.url || '';
        return '';
    }
    // In gebruik: andere bron dan de provider-API, en de opgeslagen gids hoort bij die bron
    function active() { return !!(meta && meta.url && meta.url === url()); }

    // ---- Namen vergelijken: "NL | NPO 1 HD" en "NPO 1" worden allebei "npo1" ----
    var QUALITY = /\b(uhd|fhd|hd|sd|4k|8k|hevc|h265|h264|1080p?|720p?|2160p?|50fps|60fps|backup|raw|vip|hq|lq)\b/g;
    function nm(s) {
        return U.norm(String(s || '')).replace(/^\s*\|?\s*[a-z]{2,3}\s*\|?\s*[:|\-]\s+/, '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
            .replace(QUALITY, ' ').replace(/[^a-z0-9+]+/g, '');
    }

    // ---- XML lezen ----
    function attrRe(name) { return new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')'); }
    var RE = { id: attrRe('id'), channel: attrRe('channel'), start: attrRe('start'), stop: attrRe('stop') };
    function attr(el, re) { var m = re.exec(el); return m ? (m[1] != null ? m[1] : m[2]) : ''; }
    var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    function decode(s) {
        return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (all, e) {
            if (e[0] === '#') { var n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n ? String.fromCharCode(n) : ''; }
            return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : all;
        }).trim();
    }
    // Inhoud van de eerste <name …>…</name>
    function tag(el, name) {
        var a = el.indexOf('<' + name);
        if (a < 0) return '';
        var b = el.indexOf('>', a), c = el.indexOf('</' + name + '>', b);
        return b < 0 || c < 0 ? '' : decode(el.slice(b + 1, c));
    }
    function tags(el, name) {
        var out = [], pos = 0, a;
        while ((a = el.indexOf('<' + name, pos)) >= 0) {
            var b = el.indexOf('>', a), c = el.indexOf('</' + name + '>', b);
            if (b < 0 || c < 0) break;
            out.push(decode(el.slice(b + 1, c)));
            pos = c + name.length + 3;
        }
        return out;
    }
    // "20261007153000 +0200" -> ms (zonder tijdzone: UTC, zoals de XMLTV-standaard zegt)
    function time(s) {
        var m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?\s*([+-]\d\d:?\d\d)?/.exec(s || '');
        if (!m) return 0;
        var t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
        if (m[7]) {
            var z = m[7].replace(':', ''), off = (parseInt(z.slice(1, 3), 10) * 60 + parseInt(z.slice(3, 5), 10)) * (z[0] === '-' ? -1 : 1);
            t -= off * 60000;
        }
        return t;
    }

    // Wat willen we bewaren: epg-id's en zendernamen van de provider, plus handmatige koppelingen
    function wantFrom(streams) {
        var ids = {}, names = {};
        streams.forEach(function (s) {
            if (s.epg_channel_id) ids[String(s.epg_channel_id).toLowerCase()] = 1;
            var n = nm(s.name);
            if (n) names[n] = 1;
        });
        var map = Store.getP('epgMap', {}) || {};
        Object.keys(map).forEach(function (k) { if (map[k]) ids[String(map[k]).toLowerCase()] = 1; });
        return { ids: ids, names: names };
    }

    // Een (eventueel gzip-)stroom lezen. Geeft { channels: [[id, naam]], progs: { id: [[start, eind, titel, beschrijving]] }, n }
    function parse(stream, want, onBytes) {
        var reader = stream.getReader(), first = true, dec = new TextDecoder('utf-8'), buf = '', bytes = 0;
        var from = Date.now() - BACK, to = Date.now() + AHEAD;
        var keep = {}, channels = [], progs = {}, n = 0;
        function onChannel(el) {
            var id = attr(el, RE.id), names = tags(el, 'display-name');
            if (!id) return;
            var lid = id.toLowerCase();
            channels.push([lid, names[0] || id]);
            if (want.ids[lid] || names.some(function (x) { return want.names[nm(x)]; })) keep[lid] = 1;
        }
        function onProg(el) {
            var ch = attr(el, RE.channel).toLowerCase();
            if (!keep[ch] && !want.ids[ch]) return;
            var a = time(attr(el, RE.start)), b = time(attr(el, RE.stop));
            if (!a || !b || b <= a || b < from || a > to) return;
            var d = tag(el, 'desc');
            (progs[ch] = progs[ch] || []).push([a, b, tag(el, 'title'), d.length > DESC ? d.slice(0, DESC - 1) + '…' : d]);
            n++;
        }
        // Complete <channel>- en <programme>-elementen uit de buffer halen; de rest bewaren voor het volgende stuk
        function eat() {
            var pos = 0;
            for (;;) {
                var a = buf.indexOf('<channel', pos), b = buf.indexOf('<programme', pos);
                if (a >= 0 && !/[\s>]/.test(buf.charAt(a + 8))) a = -1;   // geen <channel… zoals <channelgroup
                var at = a < 0 ? b : b < 0 ? a : Math.min(a, b);
                if (at < 0) { pos = Math.max(pos, buf.length - 16); break; }
                var isCh = at === a, close = isCh ? '</channel>' : '</programme>';
                var end = buf.indexOf(close, at);
                if (end < 0) { pos = at; break; }
                var el = buf.slice(at, end);
                if (isCh) onChannel(el); else onProg(el);
                pos = end + close.length;
            }
            buf = buf.slice(pos);
        }
        function read(r) {
            return r.read().then(function (x) {
                if (x.done) { buf += dec.decode(); eat(); return; }
                bytes += x.value.length;
                if (onBytes) onBytes(bytes);
                buf += dec.decode(x.value, { stream: true });
                eat();
                return read(r);
            });
        }
        // Eerste bytes 1f 8b = gzip: uitpakken (ook als de server dat niet zelf aangeeft)
        return reader.read().then(function (x) {
            if (x.done) return;
            var gz = x.value[0] === 0x1f && x.value[1] === 0x8b;
            if (!gz) { bytes = x.value.length; buf = dec.decode(x.value, { stream: true }); eat(); return read(reader); }
            if (!window.DecompressionStream) throw new Error(T('Deze TV kan geen ingepakte (.gz) gids uitpakken; gebruik een .xml-adres'));
            var head = x.value, raw = new ReadableStream({
                start: function (c) { c.enqueue(head); },
                pull: function (c) { return reader.read().then(function (y) { if (y.done) c.close(); else c.enqueue(y.value); }); }
            });
            return read(raw.pipeThrough(new DecompressionStream('gzip')).getReader());
        }).then(function () {
            Object.keys(progs).forEach(function (k) { progs[k].sort(function (p, q) { return p[0] - q[0]; }); });
            return { channels: channels, progs: progs, n: n, bytes: bytes };
        });
    }

    function open(u) {
        if (/^demo:/.test(u)) return Promise.resolve(new Response(Demo.xmltv()).body);
        var ctrl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10 * 60e3);
        return fetch(u, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
            clearTimeout(timer);
            if (!r.ok) throw new Error(T('Server gaf foutcode {code}', { code: r.status }));
            if (!r.body) throw new Error(T('Deze TV kan de gids niet in delen lezen'));
            return r.body;
        }, function (e) {
            clearTimeout(timer);
            throw new Error(e && e.name === 'AbortError' ? T('Downloaden duurde te lang') : T('Gids downloaden mislukt (adres niet bereikbaar)'));
        });
    }

    // ---- Downloaden en bewaren ----
    function refresh(force) {
        var u = url();
        if (!u) return Promise.resolve(null);
        if (running) return running;
        return running = loadMeta().then(function () {
            if (!force && meta && meta.url === u && Date.now() - meta.at < MAX_AGE) return meta;
            progress = 0;
            lastError = '';
            return Promise.all([Api.liveCategories(), Api.liveStreams()]).then(function (r) {
                // Zonder 18+ (scheelt geheugen bij grote gidsen); verborgen zenders wel, die kun je weer tonen
                var full = Lineup.build(r[0], r[1]).full, streams = Object.keys(full).map(function (k) { return full[k]; });
                return open(u).then(function (body) { return parse(body, wantFrom(streams), function (b) { progress = b; }); }).then(function (res) {
                    if (!res.channels.length && !res.n) throw new Error(T('Dit lijkt geen XMLTV-gids'));
                    var rows = Object.keys(res.progs).map(function (k) { return [k, res.progs[k]]; });
                    var has = {};
                    rows.forEach(function (r) { has[r[0]] = 1; });
                    var m = { url: u, at: Date.now(), channels: res.channels, has: has, kept: rows.length, n: res.n, bytes: res.bytes, total: streams.length };
                    return Db.clear(STORE).then(function () {
                        var chain = Promise.resolve();
                        for (var i = 0; i < rows.length; i += 300) (function (part) { chain = chain.then(function () { return Db.putMany(STORE, part); }); })(rows.slice(i, i + 300));
                        return chain;
                    }).then(function () { return Db.put(STORE, META, m); }).then(function () {
                        meta = m; idx = null; mem = {};
                        m.matched = coverage(streams);
                        EPG.reset();
                        return m;
                    });
                });
            });
        }).catch(function (e) {
            lastError = e.message || String(e);
            throw e;
        }).then(function (m) { running = null; progress = null; return m; }, function (e) { running = null; progress = null; throw e; });
    }

    function loadMeta() {
        if (!metaP) metaP = Db.get(STORE, META).then(function (m) { meta = m || null; return meta; }).catch(function () { return null; });
        return metaP;
    }
    function reset() { meta = null; metaP = null; idx = null; mem = {}; }

    // ---- Opzoeken per zender ----
    // Index: welke gids-id's hebben programma's, en naam -> id
    function index() {
        if (idx) return idx;
        var ids = {}, names = {};
        (meta.channels || []).forEach(function (c) { ids[c[0]] = c[1]; var n = nm(c[1]); if (n && !names[n]) names[n] = c[0]; });
        return idx = { ids: ids, names: names };
    }
    // Gids-id voor een zender: handmatig gekoppeld, anders epg-id van de provider, anders op naam
    function idFor(s) {
        if (!meta) return null;
        var map = Store.getP('epgMap', {}) || {}, man = map[String(s.stream_id)];
        if (man === '-') return null;              // bewust geen XMLTV voor deze zender
        if (man) return man;
        var I = index(), e = String(s.epg_channel_id || '').toLowerCase();
        if (e && I.ids[e] != null) return e;
        return I.names[nm(s.name)] || null;
    }
    function coverage(streams) { return streams.filter(function (s) { return idFor(s); }).length; }

    var mem = {};   // laatst gelezen zenders (gids-id -> programma's)
    // Programma's van een zender, of null (dan gebruikt de EPG-module de provider)
    function list(streamId) {
        if (url() === '') return Promise.resolve(null);
        return loadMeta().then(function () {
            if (!active()) return null;
            return Api.liveStreams().then(function (streams) {
                var s = streams.filter(function (x) { return String(x.stream_id) === String(streamId); })[0];
                var id = s && idFor(s);
                if (!id) return null;
                if (mem[id]) return mem[id];
                return Db.get(STORE, id).then(function (rows) {
                    var l = rows ? rows.map(function (r) { return { title: r[2] || T('Onbekend programma'), desc: r[3] || '', start: r[0], end: r[1] }; }) : null;
                    var keys = Object.keys(mem);
                    if (keys.length > 300) delete mem[keys[0]];
                    mem[id] = l;
                    return l;
                });
            });
        }).catch(function () { return null; });
    }

    // Handmatig koppelen (gidsId '' = automatisch, '-' = nooit XMLTV voor deze zender)
    function link(streamId, gidsId) {
        var map = Object.assign({}, Store.getP('epgMap', {}) || {});
        if (gidsId) map[String(streamId)] = gidsId; else delete map[String(streamId)];
        Store.setP('epgMap', map);
        mem = {};
        EPG.reset();
        // Gidszender waarvan nog geen programma's bewaard zijn (we bewaren alleen wat bij je zenders past): opnieuw downloaden
        return !!(gidsId && gidsId !== '-' && meta && !(meta.has && meta.has[gidsId]));
    }
    function linked(streamId) { return (Store.getP('epgMap', {}) || {})[String(streamId)] || ''; }
    // Gidszenders die op de zoektekst lijken (voor handmatig koppelen)
    function search(q) {
        if (!meta) return [];
        return meta.channels.map(function (c) { return { id: c[0], name: c[1], s: Math.max(Find.score(q, c[1]), Find.score(q, c[0])) }; })
            .filter(function (c) { return c.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 30);
    }
    function nameOf(id) { return meta ? index().ids[id] || id : id; }

    // Tekst voor Instellingen
    var counting = false;
    function status() {
        var s = source();
        if (s.mode === 'api') return '';
        // Opgeslagen gids nog niet ingelezen, of aantal gekoppelde zenders nog niet geteld: op de achtergrond (volgende tik klopt het)
        loadMeta();
        if (meta && meta.matched == null && !counting) { counting = true; count().then(function () { counting = false; }, function () { counting = false; }); }
        if (running) return progress ? T('Downloaden… {mb} MB', { mb: (progress / 1048576).toFixed(1) }) : T('Bezig…');
        if (lastError) return T('Mislukt: {error}', { error: lastError });
        if (!active()) return T('Nog niet geladen');
        return T('Bijgewerkt {time}', { time: U.fmtDate(meta.at) + ' ' + U.fmtClock(meta.at) }) +
            (meta.matched != null ? ' · ' + T('{n} van {total} zenders', { n: meta.matched, total: meta.total || '?' }) : ' · ' + T('{n} zenders', { n: meta.kept }));
    }
    // Aantal gekoppelde zenders opnieuw tellen (voor de statusregel)
    function count() {
        return Promise.all([loadMeta(), Api.liveCategories(), Api.liveStreams()]).then(function (r) {
            if (!active()) return null;
            var full = Lineup.build(r[1], r[2]).full, streams = Object.keys(full).map(function (k) { return full[k]; });
            meta.matched = coverage(streams);
            meta.total = streams.length;
            return meta;
        });
    }

    return {
        source: source, setSource: setSource, url: url, active: active, refresh: refresh, loadMeta: loadMeta, reset: reset,
        list: list, link: link, linked: linked, search: search, nameOf: nameOf, idFor: idFor, status: status, count: count,
        busy: function () { return !!running; },
        // Voor tests
        parse: parse, time: time, nm: nm, wantFrom: wantFrom
    };
})();
