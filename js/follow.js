/* Nieuwe afleveringen: per gevolgde serie bijhouden welke afleveringen er al waren, en melden wat er bijkomt.
   Gevolgd = in Mijn lijst of in Verder kijken. Werkt alleen als de app open is (Tizen-webapps draaien niet op de achtergrond). */
var Follow = (function () {
    'use strict';

    var INTERVAL = 3 * 3600e3; // automatisch hooguit eens per 3 uur controleren
    var busy = null;

    // { s: { serieId: { ids: [afleverings-id's] } }, fresh: { serieId: { name, icon, eps: [...], at } }, checked: tijdstip }
    function data() {
        var d = Store.getP('follow', null);
        if (!d) { d = { s: {}, fresh: {}, checked: 0 }; Store.setP('follow', d); }
        return d;
    }
    function save() { Store.setP('follow', data()); }

    function followed() {
        var m = {};
        Store.favorites('series').forEach(function (f) { m[f.id] = { id: f.id, name: f.name, icon: f.icon, tmdb: f.tmdb }; });
        Store.history().forEach(function (h) { if (h.series && !m[h.series.id]) m[h.series.id] = { id: h.series.id, name: h.series.name, icon: h.series.icon, tmdb: h.series.tmdb }; });
        return Object.keys(m).map(function (k) { return m[k]; });
    }

    // Vergelijkt de huidige afleveringen met wat we kenden; geeft het aantal nieuwe terug
    function update(f, res) {
        var d = data(), flat = App.parseSeries(res).flat, known = d.s[f.id];
        var ids = flat.map(function (e) { return e.id; });
        if (!known) { d.s[f.id] = { ids: ids }; return 0; } // eerste keer: alleen nulmeting
        var had = {};
        known.ids.forEach(function (id) { had[id] = 1; });
        var added = flat.filter(function (e) { return !had[e.id]; });
        known.ids = ids;
        if (!added.length) return 0;
        var fr = d.fresh[f.id] || { eps: [] };
        added.forEach(function (e) {
            if (!fr.eps.some(function (x) { return x.id === e.id; })) fr.eps.push({ id: e.id, season: e.season, episode: e.episode, name: e.name });
        });
        fr.name = f.name;
        fr.icon = f.icon;
        fr.tmdb = f.tmdb || fr.tmdb || '';
        fr.at = Date.now();
        d.fresh[f.id] = fr;
        return added.length;
    }

    // Nulmeting voor een serie die net aan Mijn lijst is toegevoegd
    function track(f, res) {
        if (data().s[f.id]) return;
        (res ? Promise.resolve(res) : Api.seriesInfo(f.id)).then(function (r) { update(f, r); save(); }).catch(function () { /* later opnieuw */ });
    }

    function check(force) {
        if (busy) return busy;
        var d = data();
        if (!force && Date.now() - (d.checked || 0) < INTERVAL) return Promise.resolve(0);
        var queue = followed().slice(0, 60), total = 0, series = [];
        function next() {
            var f = queue.shift();
            if (!f) return Promise.resolve();
            return Api.seriesInfo(f.id).then(function (res) {
                var n = update(f, res);
                if (n) { total += n; series.push(f.id); }
            }).catch(function () { /* serie tijdelijk niet bereikbaar */ }).then(next);
        }
        busy = Promise.all([next(), next()]).then(function () {
            busy = null;
            data().checked = Date.now();
            save();
            if (total) notify(series);
            return total;
        });
        return busy;
    }

    function notify(ids) {
        var d = data();
        if (ids.length === 1) {
            var fr = d.fresh[ids[0]], e = fr.eps[fr.eps.length - 1];
            Toast.show(T('Nieuwe aflevering: {title} S{season} E{episode}', { title: fr.name, season: U.pad(+e.season), episode: U.pad(+e.episode) }), 6000);
        } else Toast.show(T('Nieuwe afleveringen in {n} series', { n: ids.length }), 6000);
        var s = App.screen();
        if (s === Screens.home) Screens.home.render(Screens.home.rows.state());
    }

    // Series met nieuwe afleveringen, nieuwste eerst
    function fresh() {
        var d = data();
        return Object.keys(d.fresh).map(function (id) { return Object.assign({ id: id }, d.fresh[id]); })
            .filter(function (f) { return f.eps && f.eps.length; })
            .sort(function (a, b) { return b.at - a.at; });
    }
    function isFresh(seriesId, epId) {
        var fr = data().fresh[seriesId];
        return !!(fr && fr.eps.some(function (e) { return e.id === String(epId); }));
    }
    function hasFresh(seriesId) { var fr = data().fresh[seriesId]; return !!(fr && fr.eps.length); }

    // Aflevering bekeken of serie geopend: niet meer als nieuw tonen
    function clear(seriesId, epId) {
        var d = data(), fr = d.fresh[seriesId];
        if (!fr) return;
        if (epId != null) fr.eps = fr.eps.filter(function (e) { return e.id !== String(epId); });
        if (epId == null || !fr.eps.length) delete d.fresh[seriesId];
        save();
    }

    function forget(seriesId) { var d = data(); delete d.s[seriesId]; delete d.fresh[seriesId]; save(); }

    return { check: check, track: track, fresh: fresh, isFresh: isFresh, hasFresh: hasFresh, clear: clear, forget: forget };
})();
