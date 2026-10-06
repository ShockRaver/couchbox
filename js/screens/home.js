/* Startscherm in streaming-stijl: menu bovenaan, groot hero-blok van het geselecteerde item, rijen eronder */
Screens.home = {
    longOk: true, // OK ingedrukt houden op "Verder kijken" = opties

    build: function () {
        var self = this;
        this.el = UI.screen('home', 'nf');
        this.heroBox = U.h('div');
        this.hero = new Hero(this.heroBox);
        this.nav = new TopNav('home');
        this.rowsBox = U.h('div', { class: 'nf-rows' });
        this.el.appendChild(this.heroBox);
        this.el.appendChild(this.rowsBox);
        this.el.appendChild(this.nav.el);
        this.rows = new RowStack(this.rowsBox);
        // Nieuwe gegevens voor het geselecteerde item (bv. backdrop): kaarten in beeld verversen
        this.hero.onUpdate = function () { self.rows.rows.forEach(function (r) { if (r.id === 'hist') r.list.refresh(); }); };
        this.heroT = null;
        this.updateHero = function () { clearTimeout(self.heroT); self.heroT = setTimeout(function () { self.showHero(); }, 150); };
    },

    show: function () { this.render(null); },
    resume: function () { this.render(this.rows.state()); },
    hide: function () { clearTimeout(this.heroT); },

    render: function (st) {
        var R = this.rows;
        R.clear();

        var hist = Store.history();
        if (hist.length) R.add({
            id: 'hist', title: 'Verder kijken', items: hist, itemW: 400, itemH: 290,
            render: UI.histCard,
            // Eén druk op OK = direct verder kijken; OK ingedrukt houden = opties
            onSelect: function (h) { App.playHistory(h, h.position); }
        });

        var fresh = Follow.fresh();
        if (fresh.length) R.add({
            id: 'fresh', title: 'Nieuwe afleveringen', items: fresh, itemW: 184, itemH: 320,
            render: function (f) {
                var e = f.eps[f.eps.length - 1];
                return UI.posterCard({
                    small: true, name: f.name, icon: Meta.poster('t', f, f.icon), tag: 'Nieuw',
                    sub: f.eps.length > 1 ? f.eps.length + ' nieuwe afleveringen' : 'S' + U.pad(+e.season) + ' E' + U.pad(+e.episode) + ' nieuw'
                });
            },
            onSelect: function (f) { App.go('series', { item: { series_id: f.id, name: f.name, cover: f.icon, tmdb: f.tmdb || '' } }); }
        });

        var mine = Store.favorites('movie').map(function (f) { return Object.assign({ _type: 'movie' }, f); })
            .concat(Store.favorites('series').map(function (f) { return Object.assign({ _type: 'series' }, f); })).reverse();
        if (mine.length) R.add({
            id: 'favs', title: 'Mijn lijst', items: mine, itemW: 184, itemH: 320,
            render: function (f) {
                var t = f._type === 'movie' ? 'm' : 't', isNew = t === 't' && Follow.hasFresh(f.id);
                return UI.posterCard({ small: true, name: f.name, icon: Meta.poster(t, f, f.icon), rating: Meta.rating(t, f), tag: isNew ? 'Nieuw' : '' });
            },
            onSelect: function (f) {
                if (f._type === 'movie') App.go('movie', { item: App.vodFromFav(f) });
                else App.go('series', { item: App.seriesFromFav(f) });
            }
        });

        var last = Store.lastChannel(), favs = Store.favorites('live').map(App.chFromFav), chans = favs.slice();
        if (last) {
            chans = chans.filter(function (c) { return String(c.stream_id) !== String(last.stream_id); });
            chans.unshift(Object.assign({ _last: true }, last));
        }
        if (chans.length) R.add({
            id: 'chans', title: favs.length ? 'Favoriete zenders' : 'Laatst bekeken zender', items: chans, itemW: 250, itemH: 214,
            render: function (c) { return UI.logoCard(c, c._last ? 'Laatst bekeken' : ''); },
            onSelect: function (c, i, items) { App.go('player', { mode: 'live', channel: c, list: items }); }
        });

        R.restore(st);
        if (R.rows.length) {
            this.setZone(this.zone === 'nav' && st ? 'nav' : 'rows');
            this.showHero();
        } else {
            this.setZone('nav');
            this.hero.message('Welkom bij Kijkdoos', 'Kies Films, Series of Live TV in het menu bovenaan. Wat je kijkt en bewaart in Mijn lijst verschijnt daarna hier.');
        }
    },

    // Hero toont het geselecteerde item (of het eerste item als de focus in het menu staat)
    showHero: function () {
        var r = this.rows.rows[this.rows.cur], it = r && r.list.current();
        if (!it) return;
        var H = this.hero;
        if (r.id === 'hist') {
            UI.heroHistory(H, it);
        } else if (r.id === 'fresh') H.forItem('t', { series_id: it.id, name: it.name, tmdb: it.tmdb }, '<b>🔔 Nieuw</b>');
        else if (r.id === 'favs') H.forItem(it._type === 'movie' ? 'm' : 't', it._type === 'movie' ? App.vodFromFav(it) : App.seriesFromFav(it));
        else if (r.id === 'chans') H.forChannel(it);
    },

    setZone: function (z) {
        this.zone = z;
        this.nav.setFocus(z === 'nav');
        this.rows.setActive(z === 'rows');
    },
    navFocus: function (b) { this.setZone(b ? 'nav' : 'rows'); },

    openHistory: function (h) {
        var self = this, ep = h.mode === 'episode' && h.series;
        Dialog.menu({
            title: ep ? h.series.name : h.name,
            text: App.historyLabel(h, true),
            image: (ep && h.series.icon) || h.icon, imageName: ep ? h.series.name : h.name,
            progress: h.duration ? h.position / h.duration : 0,
            items: [
                { id: 'resume', label: h.upNext || !h.position ? 'Afspelen' : 'Verder kijken vanaf ' + U.fmtTime(h.position) },
                { id: 'start', label: 'Vanaf het begin' },
                { id: 'info', label: ep ? 'Naar de serie' : 'Filminformatie' },
                { id: 'del', label: 'Verwijderen uit Verder kijken', danger: true }
            ]
        }, function (it) {
            if (!it) return;
            if (it.id === 'resume' || it.id === 'start') App.playHistory(h, it.id === 'resume' ? h.position : 0);
            else if (it.id === 'info') {
                if (ep) App.go('series', { item: { series_id: h.series.id, name: h.series.name, cover: h.series.icon, tmdb: h.series.tmdb || '' } });
                else App.go('movie', { item: { stream_id: h.id, name: h.name, stream_icon: h.icon, container_extension: h.ext, tmdb: h.tmdb || '' } });
            } else if (it.id === 'del') { Store.removeProgress(h.key); self.render(self.rows.state()); }
        });
    },

    onKey: function (k) {
        if (this.zone === 'nav') {
            if (k === 'down') { if (this.rows.rows.length) this.setZone('rows'); return true; }
            if (k === 'longok') k = 'ok';
            return this.nav.key(k) || k === 'up';
        }
        switch (k) {
            case 'up': if (!this.rows.move('up')) this.setZone('nav'); else this.updateHero(); return true;
            case 'down': case 'left': case 'right': if (this.rows.move(k)) this.updateHero(); return true;
            case 'ok': this.rows.select(); return true;
            case 'longok':
                var r = this.rows.rows[this.rows.cur];
                if (r && r.id === 'hist') this.openHistory(r.list.current()); else this.rows.select();
                return true;
        }
        return false;
    }
};
