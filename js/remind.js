/* Herinneringen voor programma's in de TV-gids (per profiel).
   Werkt zolang de app open is: kort voor de start verschijnt een melding met "Kijken". */
var Remind = (function () {
    'use strict';

    var EARLY = 60e3;   // één minuut van tevoren melden

    function key(ch, p) { return ch.stream_id + ':' + p.start; }
    function list() { return Store.getP('reminders', []) || []; }
    function save(l) { Store.setP('reminders', l); }

    function has(ch, p) { var k = key(ch, p); return list().some(function (r) { return r.key === k; }); }

    // Aan/uit; geeft true terug als de herinnering nu aan staat
    function toggle(ch, p) {
        var k = key(ch, p), l = list(), on = !l.some(function (r) { return r.key === k; });
        if (on) l.push({ key: k, title: p.title, start: p.start, end: p.end, ch: { stream_id: ch.stream_id, name: ch.name, stream_icon: ch.stream_icon, num: ch.num } });
        else l = l.filter(function (r) { return r.key !== k; });
        save(l);
        return on;
    }

    // Elke 20 seconden: meldingen tonen die aan de beurt zijn, verlopen herinneringen opruimen
    function check() {
        var now = Date.now(), l = list(), due = l.filter(function (r) { return r.start - EARLY <= now && now < r.end; });
        var rest = l.filter(function (r) { return r.start - EARLY > now; });
        if (rest.length !== l.length) save(rest);
        due.forEach(function (r) {
            Dialog.menu({
                title: (r.start > now ? 'Begint zo: ' : 'Nu begonnen: ') + r.title,
                text: r.ch.name + '  ·  ' + U.fmtClock(r.start) + ' – ' + U.fmtClock(r.end),
                items: [{ id: 'watch', label: 'Kijken' }, { id: 'close', label: 'Sluiten' }]
            }, function (it) {
                if (it && it.id === 'watch') App.go('player', { mode: 'live', channel: r.ch, list: [r.ch] });
            });
        });
    }

    function start() { setInterval(check, 20000); setTimeout(check, 3000); }

    return { has: has, toggle: toggle, check: check, start: start, count: function () { return list().length; } };
})();
