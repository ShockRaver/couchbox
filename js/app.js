/* App-kern: navigatie tussen schermen, afstandsbediening en opstarten */
var App = {
    VERSION: '1.0.0',
    stack: [],

    screen: function () { var t = this.stack[this.stack.length - 1]; return t ? Screens[t.name] : null; },

    enter: function (entry, resume) {
        var s = Screens[entry.name];
        if (!s._built) { s.build(); s._built = true; }
        Object.keys(Screens).forEach(function (n) { var o = Screens[n]; if (o._built && o !== s) o.el.classList.remove('show'); });
        s.el.classList.add('show');
        if (!s.keepVideo) Player.stop();
        if (resume && s.resume) s.resume(entry.params || {}); else s.show(entry.params || {});
    },
    leave: function () { var s = this.screen(); if (s && s.hide) s.hide(); },

    go: function (name, params) { this.leave(); this.stack.push({ name: name, params: params || {} }); this.enter(this.stack[this.stack.length - 1], false); },
    reset: function (name, params) { this.leave(); this.stack = [{ name: name, params: params || {} }]; this.enter(this.stack[0], false); },
    back: function () {
        if (this.stack.length <= 1) {
            // Vanuit een menu-onderdeel eerst terug naar Home, pas daar afsluiten
            if (this.stack[0] && this.stack[0].name !== 'home') this.reset('home');
            else this.exitPrompt();
            return;
        }
        this.leave();
        this.stack.pop();
        this.enter(this.stack[this.stack.length - 1], true);
    },

    exitPrompt: function () {
        var self = this;
        Dialog.confirm('Afsluiten', 'Wil je Kijkdoos afsluiten?', function (yes) { if (yes) self.exit(); }, 'Afsluiten');
    },
    exit: function () {
        Player.stop();
        try { tizen.application.getCurrentApplication().exit(); } catch (e) { Toast.show('Afsluiten werkt alleen op de TV'); }
    },

    goSettings: function (asRoot) {
        var pin = Store.settings().pin, self = this;
        var open = function () { if (asRoot) self.reset('settings', {}); else self.go('settings', {}); };
        if (!pin) { open(); return; }
        Dialog.pin('Voer je pincode in', function (v) {
            if (v == null) return;
            if (v === pin) open(); else Toast.show('Onjuiste pincode');
        });
    },

    // Onderdeel kiezen in het menu bovenaan
    section: function (id) {
        var top = this.stack[this.stack.length - 1];
        var map = { home: ['home'], live: ['live'], movie: ['section', { mode: 'movie' }], series: ['section', { mode: 'series' }],
            guide: ['guide'], mylist: ['mylist'], search: ['search'] };
        if (id === 'settings') { this.goSettings(true); return; }
        var t = map[id];
        if (!t) return;
        if (this.stack.length === 1 && top.name === t[0] && JSON.stringify(top.params || {}) === JSON.stringify(t[1] || {})) {
            var s = this.screen();
            if (s && s.navFocus) s.navFocus(false);
            return;
        }
        this.reset(t[0], t[1] || {});
    },

    switchProfile: function (p) {
        Store.setActive(p.id);
        Api.setProfile(p);
        EPG.reset();
        Screens.search.data = null;
        this.connect();
    },

    // Inloggen bij de server van het actieve profiel en naar het startscherm
    connect: function (autoplay) {
        var self = this, p = Store.activeProfile();
        if (!p) { this.reset('login', {}); return; }
        Api.setProfile(p);
        Loader.show('Verbinden met ' + p.name + '…');
        Api.login().then(function () {
            Loader.hide();
            self.reset('home');
            // Genres via TMDB op de achtergrond bijwerken (alleen nieuwe titels), even na het opstarten
            Tmdb.stop();
            setTimeout(Tmdb.start, 20000);
            // Gevolgde series controleren op nieuwe afleveringen
            setTimeout(function () { Follow.check(false); }, 8000);
            if (autoplay) self.startupAction();
        }).catch(function (e) {
            Loader.hide();
            self.reset('home');
            Dialog.menu({
                title: 'Verbinding mislukt', text: e.message,
                items: [{ id: 'retry', label: 'Opnieuw proberen' }, { id: 'profiles', label: 'Profielen beheren' }, { id: 'close', label: 'Sluiten' }]
            }, function (it) {
                if (it && it.id === 'retry') self.connect(autoplay);
                else if (it && it.id === 'profiles') self.go('profiles', {});
            });
        });
    },

    // Alles opnieuw ophalen bij de Xtream-server (categorieën, films, series, zenders en gids)
    refreshCatalog: function (done) {
        Api.clearCache();
        EPG.reset();
        Genres.reset();
        Screens.search.data = null;
        Loader.show('Lijst vernieuwen bij je provider…');
        Promise.all([Api.login(), Api.vodCategories(), Api.seriesCategories(), Api.liveCategories()]).then(function () {
            Loader.hide();
            Toast.show('Lijst vernieuwd (' + U.fmtClock(Date.now()) + ')');
            if (done) done();
            // Nieuwe titels ook bij TMDB opzoeken, en gevolgde series op nieuwe afleveringen controleren
            Tmdb.stop();
            setTimeout(Tmdb.start, 3000);
            Follow.check(true);
        }).catch(function (e) {
            Loader.hide();
            Dialog.alert('Vernieuwen mislukt', e.message);
        });
    },

    // Film of serie aan Mijn lijst toevoegen/verwijderen. type: 'movie' | 'series'; fav: { id, name, icon, … }
    // seriesInfo (optioneel): al geladen afleveringen, voor de nulmeting van nieuwe afleveringen
    toggleMyList: function (type, fav, seriesInfo) {
        var added = Store.toggleFav(type, fav);
        Toast.show(added ? '＋ ' + fav.name + ' staat in Mijn lijst' : fav.name + ' verwijderd uit Mijn lijst');
        if (type === 'series' && added) Follow.track(fav, seriesInfo);
        return added;
    },

    // TMDB-id van een film/serie opvragen bij de provider (filminfo/serie-info), voor items zonder id
    tmdbFor: function (type, pid) {
        var c = this.tmdbCache || (this.tmdbCache = {}), key = type + ':' + pid;
        if (key in c) return Promise.resolve(c[key]);
        var p = type === 'm'
            ? Api.vodInfo(pid).then(function (r) { var i = r && r.info && !Array.isArray(r.info) ? r.info : {}; return i.tmdb_id || i.tmdb || (r && r.movie_data && r.movie_data.tmdb); })
            : Api.seriesInfo(pid).then(function (r) { var i = r && r.info && !Array.isArray(r.info) ? r.info : {}; return i.tmdb || i.tmdb_id; });
        return p.then(function (v) { return (c[key] = Tmdb.idOf({ tmdb: v })); }).catch(function () { return (c[key] = null); });
    },

    // Wat er bij het opstarten gebeurt (Instellingen → Bij opstarten)
    startupAction: function () {
        var mode = Store.settings().startup, self = this;
        if (mode === 'live') {
            var last = Store.lastChannel();
            if (last) this.go('player', { mode: 'live', channel: last, list: null });
            return;
        }
        if (mode !== 'ask') return;
        // Alleen vragen bij iets dat je de afgelopen 2 weken keek
        var h = Store.history()[0];
        if (!h || Date.now() - (h.t || 0) > 14 * 86400e3) return;
        var ep = h.mode === 'episode' && h.series;
        Dialog.menu({
            title: 'Verder kijken?',
            image: ep ? Meta.poster('t', { tmdb: h.series.tmdb }, h.series.icon) : Meta.poster('m', { tmdb: h.tmdb }, h.icon),
            imageName: ep ? h.series.name : h.name,
            text: (ep ? h.series.name : h.name) + '\n' + this.historyLabel(h, true),
            progress: h.duration ? h.position / h.duration : 0,
            items: [{ id: 'play', label: h.upNext ? 'Afspelen' : 'Verder kijken' }, { id: 'home', label: 'Naar het startscherm' }]
        }, function (it) {
            if (it && it.id === 'play') self.playHistory(h, h.position);
        });
    },

    // Klaar met kijken? Bij minder dan 10% (max. 8 minuten) over: aftiteling
    isFinished: function (pos, dur) {
        if (!dur || !pos) return false;
        return pos / dur > 0.97 || dur - pos < Math.min(8 * 60000, dur * 0.1);
    },

    // Tekst bij een "Verder kijken"-regel, bv. "S04 E03 · 72%" of "Volgende: S04 E04"
    historyLabel: function (h, long) {
        var pct = h.duration ? Math.round(h.position / h.duration * 100) : 0;
        if (h.mode === 'episode') {
            var se = 'S' + U.pad(+h.season || 0) + ' E' + U.pad(+h.episode || 0);
            if (h.upNext) return 'Volgende: ' + se + (long && h.name ? ' · ' + h.name : '');
            return se + (long && h.name ? ' · ' + h.name : '') + ' · ' + pct + '%';
        }
        return pct + '% · nog ' + Math.max(1, Math.round((h.duration - h.position) / 60000)) + ' min';
    },

    playHistory: function (h, startAt) {
        this.go('player', {
            mode: h.mode,
            item: { id: h.id, name: h.name, icon: h.icon, ext: h.ext, season: h.season, episode: h.episode, tmdb: h.tmdb || '' },
            series: h.series || null,
            startAt: startAt
        });
    },

    // ---- Omzetten tussen Xtream-objecten en compacte favorieten ----
    chMin: function (c) { return { stream_id: c.stream_id, name: c.name, stream_icon: c.stream_icon, num: c.num, category_id: c.category_id }; },
    favFromCh: function (c) { return { id: c.stream_id, name: c.name, icon: c.stream_icon, num: c.num, category_id: c.category_id }; },
    chFromFav: function (f) { return { stream_id: f.id, name: f.name, stream_icon: f.icon, num: f.num, category_id: f.category_id }; },
    favFromVod: function (v) { return { id: v.stream_id, name: v.name, icon: v.stream_icon, ext: v.container_extension, rating: v.rating, tmdb: v.tmdb || '' }; },
    vodFromFav: function (f) { return { stream_id: f.id, name: f.name, stream_icon: f.icon, container_extension: f.ext, rating: f.rating, tmdb: f.tmdb || '' }; },
    favFromSeries: function (s) { return { id: s.series_id, name: s.name, icon: s.cover, rating: s.rating, tmdb: s.tmdb || '' }; },
    seriesFromFav: function (f) { return { series_id: f.id, name: f.name, cover: f.icon, rating: f.rating, tmdb: f.tmdb || '' }; },

    catIds: function (s) {
        var ids = Array.isArray(s.category_ids) && s.category_ids.length ? s.category_ids : [s.category_id];
        return ids.map(String);
    },
    inCats: function (s, map) { return App.catIds(s).some(function (id) { return map[id]; }); },

    // Categorie-id's met volwassenencontent (alleen als het filter aan staat)
    adultIds: function (cats) {
        if (!Store.settings().hideAdult) return null;
        var re = /(adult|xxx|18\s*\+|\+\s*18|porn|erotic|for adults)/i, map = {}, any = false;
        U.toArr(cats).forEach(function (c) { if (re.test(c.category_name || '')) { map[String(c.category_id)] = true; any = true; } });
        return any ? map : null;
    },

    expiryText: function () {
        var a = Api.account(), ui = a && a.user_info;
        if (!ui) return '';
        var exp = parseInt(ui.exp_date, 10);
        if (!exp) return 'Abonnement zonder einddatum';
        var days = Math.ceil((exp * 1000 - Date.now()) / 86400000);
        return 'Geldig tot ' + U.fmtDate(exp * 1000, true) + (days <= 14 ? ' (nog ' + Math.max(0, days) + ' dagen)' : '');
    },

    durText: function (secs, str) {
        var s = parseInt(secs, 10);
        if (!s && str) { var m = String(str).match(/(\d+):(\d+)(?::(\d+))?/); if (m) s = m[3] != null ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2]; }
        if (!s) return '';
        var h = Math.floor(s / 3600), mm = Math.round((s % 3600) / 60);
        return h ? h + 'u ' + mm + 'm' : mm + ' min';
    },

    // Xtream get_series_info -> seizoenen + platte lijst van afleveringen
    parseSeries: function (res) {
        var eps = (res && res.episodes) || {}, groups = {};
        function add(e) { var s = String(e.season || 1); (groups[s] = groups[s] || []).push(e); }
        if (Array.isArray(eps)) eps.forEach(function (g) { if (Array.isArray(g)) g.forEach(add); else if (g) add(g); });
        else Object.keys(eps).forEach(function (k) { U.toArr(eps[k]).forEach(function (e) { e.season = e.season || k; (groups[k] = groups[k] || []).push(e); }); });
        var metaList = U.toArr(res && res.seasons);
        var nums = Object.keys(groups).sort(function (a, b) { return (+a || 999) - (+b || 999); }); // seizoen 0 (specials) achteraan
        var seasons = nums.map(function (sn) {
            var meta = metaList.filter(function (s) { return String(s.season_number) === sn; })[0];
            var list = groups[sn].map(function (e) {
                var inf = e.info && !Array.isArray(e.info) ? e.info : {};
                return {
                    id: String(e.id), name: e.title || ('Aflevering ' + e.episode_num), icon: inf.movie_image || inf.cover_big || '',
                    ext: e.container_extension || 'mp4', season: +sn, episode: +e.episode_num || 0,
                    plot: inf.plot || '', dur: +inf.duration_secs || 0, durText: inf.duration || ''
                };
            }).sort(function (a, b) { return a.episode - b.episode; });
            return { num: +sn, name: (meta && meta.name) || (+sn === 0 ? 'Specials' : 'Seizoen ' + sn), eps: list };
        });
        var flat = [];
        seasons.forEach(function (s) { flat.push.apply(flat, s.eps); });
        var info = res && res.info && !Array.isArray(res.info) ? res.info : {};
        return { info: info, seasons: seasons, flat: flat };
    }
};

/* ---- Afstandsbediening ---- */
(function () {
    var okTimer = null, okHeld = false, okDownAt = 0, ignoreOkUntil = 0;

    function dispatch(k) {
        if (Loader.active()) return;
        if (Dialog.isOpen()) { Dialog.onKey(k); return; }
        var s = App.screen();
        if (!s) return;
        var handled = s.onKey ? s.onKey(k) : false;
        if (!handled) {
            if (k === 'back') App.back();
            else if (k === 'exit') App.exit();
        }
    }

    document.addEventListener('keydown', function (e) {
        var k = Keys.name(e), ae = document.activeElement, code = e.keyCode;
        // Tekstveld actief (Samsung-toetsenbord): alleen navigatietoetsen onderscheppen
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
            if (code === 65376 || code === 13) { e.preventDefault(); ae.blur(); ignoreOkUntil = Date.now() + 400; dispatch('inputdone'); }
            else if (code === 65385 || code === 10009 || code === 27) { e.preventDefault(); ae.blur(); ignoreOkUntil = Date.now() + 400; }
            else if (code === 38 || code === 40) { e.preventDefault(); ae.blur(); dispatch(k); }
            return;
        }
        // Gewoon toetsenbord (browser of USB aan de TV): letters en Backspace rechtstreeks naar een scherm met tekstinvoer
        var sc = App.screen();
        if (sc && sc.onChar && !Dialog.isOpen() && !Loader.active() && !e.ctrlKey && !e.metaKey && !e.altKey &&
            (e.key === 'Backspace' || (e.key && e.key.length === 1 && !/[0-9]/.test(e.key)))) {
            e.preventDefault();
            sc.onChar(e.key === 'Backspace' ? '\b' : e.key);
            return;
        }
        if (!k) return;
        e.preventDefault();
        if (k === 'ok') {
            if (Date.now() < ignoreOkUntil) return;
            if (okHeld && Date.now() - okDownAt < 2500) return; // herhaling tijdens ingedrukt houden
            okHeld = true;
            okDownAt = Date.now();
            var s = App.screen();
            if (!Dialog.isOpen() && !Loader.active() && s && s.longOk) {
                // Kort = OK, lang (>0,6 s) = 'longok' (optiemenu)
                okTimer = setTimeout(function () { okTimer = null; dispatch('longok'); }, 600);
                return;
            }
        }
        dispatch(k);
    });

    document.addEventListener('keyup', function (e) {
        if (Keys.name(e) !== 'ok') return;
        okHeld = false;
        if (okTimer) { clearTimeout(okTimer); okTimer = null; dispatch('ok'); }
    });
})();

/* ---- Opstarten ---- */
(function () {
    // Schaal de 1920x1080-UI naar het venster (op de TV is dit gewoon 1:1).
    // Op de TV maakt het Samsung-toetsenbord het venster kleiner: dan niet herschalen,
    // anders krimpt de hele app naar linksboven.
    function fit() {
        var app = document.getElementById('app'), ae = document.activeElement, s;
        if (Player.isNative()) {
            if (ae && ae.tagName === 'INPUT') return;
            s = window.innerWidth / 1920; // alleen de breedte: het toetsenbord verandert de hoogte
        } else {
            s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
        }
        app.style.transform = Math.abs(s - 1) < 0.01 ? '' : 'scale(' + s + ')';
    }

    // Na het typen: eventuele verschuiving door het toetsenbord terugzetten
    function resetView() {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
        var app = document.getElementById('app');
        app.scrollTop = 0;
        app.scrollLeft = 0;
        fit();
    }

    function clock() {
        var t = U.fmtClock(Date.now());
        var els = document.querySelectorAll('.clock');
        for (var i = 0; i < els.length; i++) els[i].textContent = t;
    }

    window.addEventListener('load', function () {
        Player.init();
        document.documentElement.classList.add(Player.isNative() ? 'tv' : 'browser');
        Keys.register();
        Dialog.init();
        Meta.ready(); // basisgegevens (posters, ratings) uit de lokale database laden
        fit();
        window.addEventListener('resize', fit);
        document.addEventListener('focusout', function (e) {
            if (e.target && e.target.tagName === 'INPUT') setTimeout(resetView, 150);
        });
        clock();
        setInterval(clock, 10000);
        if (!Store.activeProfile()) App.reset('login', {});
        else App.connect(true);
    });
})();
