/* EPG (programmagids): cache + wachtrij zodat alleen zichtbare zenders worden opgevraagd */
var EPG = (function () {
    'use strict';

    var cache = {}, queue = [], waiting = {}, active = 0, MAX = 3;

    function ts(v, str) {
        var n = parseInt(v, 10);
        if (n > 0) return n * 1000;
        return str ? Date.parse(String(str).replace(' ', 'T')) || 0 : 0;
    }

    // Speciale "limit": de volledige gids van een zender (get_simple_data_table), voor de TV-gids
    var FULL = 1000;

    function parse(res) {
        var min = Date.now() - 4 * 3600e3, max = Date.now() + 7 * 86400e3;
        var list = U.toArr(res && res.epg_listings).map(function (p) {
            return { title: U.b64(p.title) || T('Onbekend programma'), desc: U.b64(p.description), start: ts(p.start_timestamp, p.start), end: ts(p.stop_timestamp, p.end) };
        });
        // Alleen een bruikbaar tijdvak bewaren (volledige tabellen kunnen dagen terug gaan)
        list = list.filter(function (p) {
            return p.end > p.start && p.end >= min && p.start <= max;
        }).sort(function (a, b) {
            // Zelfde starttijd: de langste eerst (die blijft bewaard)
            return a.start - b.start || (b.end - b.start) - (a.end - a.start);
        });
        return clean(list);
    }

    // Overlappende programma's opruimen (providers leveren soms dubbele of verschoven regels uit meerdere gidsbronnen):
    // valt een programma binnen het vorige, dan weg; begint het eerder dan het vorige eindigt, dan het vorige inkorten.
    function clean(list) {
        var out = [];
        list.forEach(function (p) {
            var prev = out[out.length - 1];
            if (prev && p.start < prev.end) {
                if (p.start === prev.start || p.end <= prev.end) return;   // dubbel of er helemaal binnen
                if (p.start - prev.start < 60e3) return;                     // nauwelijks verschoven dubbel
                prev.end = p.start;                                          // vorige inkorten tot de start van deze
            }
            out.push(p);
        });
        return out;
    }

    // Volledige gids ophalen; valt terug op de korte EPG als de provider die niet (goed) levert
    function fetchList(id, limit) {
        if (limit < FULL) return Api.shortEpg(id, limit).then(parse);
        return Api.fullEpg(id).then(parse).catch(function () { return []; }).then(function (list) {
            var future = list.filter(function (p) { return p.end > Date.now(); });
            return future.length >= 3 ? list : Api.shortEpg(id, 24).then(parse);
        });
    }

    function fresh(c, limit) {
        if (!c || c.limit < limit) return false;
        var age = Date.now() - c.at;
        if (!c.list.length) return age < 10 * 60e3;
        return age < 60 * 60e3 && c.list[c.list.length - 1].end > Date.now();
    }

    function get(id) { var c = cache[id]; return c ? c.list : null; }

    function nowNext(id) {
        var l = get(id);
        if (!l) return null;
        var t = Date.now();
        for (var i = 0; i < l.length; i++) {
            if (l[i].end > t) {
                if (l[i].start <= t) return { cur: l[i], next: l[i + 1] || null };
                return { cur: null, next: l[i] };
            }
        }
        return { cur: null, next: null };
    }

    // Vraagt EPG op als die niet vers in de cache zit. cb wordt alleen aangeroepen na een netwerkverzoek.
    function request(id, limit, cb) {
        limit = limit || 4;
        if (fresh(cache[id], limit)) return true;
        var w = waiting[id];
        if (!w) { w = waiting[id] = { limit: 0, cbs: [] }; queue.push(id); }
        w.limit = Math.max(w.limit, limit);
        if (cb) w.cbs.push(cb);
        pump();
        return false;
    }

    function pump() {
        while (active < MAX && queue.length) {
            // Nieuwste verzoeken eerst: dat zijn de zenders die nu in beeld zijn
            var id = queue.pop(), w = waiting[id];
            delete waiting[id];
            if (!w) continue;
            active++;
            (function (id, w) {
                fetchList(id, w.limit)
                    .then(function (list) { cache[id] = { list: list, at: Date.now(), limit: w.limit }; })
                    .catch(function () { cache[id] = { list: [], at: Date.now(), limit: w.limit }; })
                    .then(function () {
                        active--;
                        w.cbs.forEach(function (f) { try { f(cache[id].list); } catch (e) { console.error(e); } });
                        pump();
                    });
            })(id, w);
        }
    }

    function reset() { cache = {}; queue = []; waiting = {}; }

    return { request: request, get: get, nowNext: nowNext, reset: reset, FULL: FULL };
})();
