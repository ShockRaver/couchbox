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
        // Hero bijwerken als je even stilstaat; bij omhoog/omlaag iets langer wachten (dan scroll je vaak door)
        this.updateHero = function (slow) { clearTimeout(self.heroT); self.heroT = setTimeout(function () { self.showHero(); }, slow ? 350 : 180); };
    },

    show: function () { this.render(null); },
    resume: function () { this.render(this.rows.state()); },
    hide: function () { clearTimeout(this.heroT); },

    render: function (st) {
        var R = this.rows;
        R.clear();
        this.specs().forEach(function (o) { R.add(o); });
        R.restore(st);
        var self = this;
        setTimeout(function () { self.updateReco(); self.updateSeason(); }, 300);
        if (R.rows.length) {
            this.setZone(this.zone === 'nav' && st ? 'nav' : 'rows');
            this.showHero();
        } else {
            this.setZone('nav');
            this.hero.message(T('Welkom bij Kijkdoos'), T('Kies Films, Series of Live TV in het menu bovenaan. Wat je kijkt en bewaart in Mijn lijst verschijnt daarna hier, samen met tips voor jou.'));
        }
    },

    // Bijwerken met gegevens die op de achtergrond binnenkomen (aanbevelingen, nieuwe afleveringen),
    // zonder het scherm opnieuw op te bouwen: de focus blijft staan waar je was
    update: function () {
        var R = this.rows, specs = this.specs();
        if (!R.rows.length || !specs.length) { this.render(R.state()); return; }
        var before = R.current();
        R.sync(specs, Screens.home.keyOf);
        if (R.current() !== before) this.showHero();
    },
    keyOf: function (x) {
        var it = x.item || x;
        return (x._type || x.type || '') + ':' + (x.key || it.stream_id || it.series_id || x.id || it.name);
    },

    // De rijen van het startscherm (zonder ze te tekenen)
    specs: function () {
        var R = { list: [], add: function (o) { this.list.push(o); } };

        var hist = Store.history();
        if (hist.length) R.add({
            id: 'hist', title: T('Verder kijken'), items: hist, itemW: 400, itemH: 290,
            render: UI.histCard,
            // Eén druk op OK = direct verder kijken; OK ingedrukt houden = opties
            onSelect: function (h) { App.playHistory(h, h.position); }
        });

        var fresh = Follow.fresh();
        if (fresh.length) R.add({
            id: 'fresh', title: T('Nieuwe afleveringen'), items: fresh, itemW: 184, itemH: 320,
            render: function (f) {
                var e = f.eps[f.eps.length - 1];
                return UI.posterCard({
                    small: true, name: f.name, icon: Meta.poster('t', f, f.icon), tag: T('Nieuw'),
                    sub: f.eps.length > 1 ? T('{n} nieuwe afleveringen', { n: f.eps.length }) : T('S{season} E{episode} nieuw', { season: U.pad(+e.season), episode: U.pad(+e.episode) })
                });
            },
            onSelect: function (f) { App.go('series', { item: { series_id: f.id, name: f.name, cover: f.icon, tmdb: f.tmdb || '' } }); }
        });

        // Seizoen (Halloween, Kerst & Sinterklaas, Valentijn): vanaf 4 weken vóór de datum, na "Verder kijken"
        (this.seasonRows || []).forEach(function (r) { R.add(UI.recoRow(r)); });

        // Aanbevelingen: de eerste direct na "Verder kijken", de rest na Mijn lijst en de zenders
        var reco = Reco.cached('home');
        if (reco[0]) R.add(UI.recoRow(reco[0]));

        var mine = Store.favorites('movie').map(function (f) { return Object.assign({ _type: 'movie' }, f); })
            .concat(Store.favorites('series').map(function (f) { return Object.assign({ _type: 'series' }, f); })).reverse();
        if (mine.length) R.add({
            id: 'favs', title: T('Mijn lijst'), items: mine, itemW: 184, itemH: 320,
            render: function (f) {
                var t = f._type === 'movie' ? 'm' : 't', isNew = t === 't' && Follow.hasFresh(f.id);
                return UI.posterCard({ small: true, name: f.name, icon: Meta.poster(t, f, f.icon), rating: Meta.rating(t, f), tag: isNew ? T('Nieuw') : '' });
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
            id: 'chans', title: favs.length ? T('Favoriete zenders') : T('Laatst bekeken zender'), items: chans, itemW: 250, itemH: 214,
            render: function (c) { return UI.logoCard(c, c._last ? T('Laatst bekeken') : ''); },
            onSelect: function (c, i, items) { App.go('player', { mode: 'live', channel: c, list: items }); }
        });

        reco.slice(1).forEach(function (r) { R.add(UI.recoRow(r)); });
        return R.list;
    },

    // Seizoensrijen berekenen (één keer per uur); daarna alleen de rijen bijwerken die veranderd zijn
    updateSeason: function () {
        var self = this;
        if (this.seasonAt && Date.now() - this.seasonAt < 3600e3) return;
        this.seasonAt = Date.now();
        Season.homeRows().then(function (rows) {
            var key = function (l) { return JSON.stringify((l || []).map(function (r) { return [r.id, r.items.length]; })); };
            if (key(rows) === key(self.seasonRows)) return;
            self.seasonRows = rows;
            if (App.screen() === self && !Dialog.isOpen()) self.update();
        }).catch(function () { self.seasonAt = 0; });
    },

    // Aanbevelingen op de achtergrond verversen; daarna alleen de rijen bijwerken die veranderd zijn
    updateReco: function () {
        var self = this;
        if (!Reco.stale('home')) return;
        Reco.refresh('home').then(function () {
            if (App.screen() === self && !Dialog.isOpen()) self.update();
        });
    },

    // Hero toont het geselecteerde item (of het eerste item als de focus in het menu staat)
    showHero: function () {
        var r = this.rows.rows[this.rows.cur], it = r && r.list.current();
        if (!it) return;
        var H = this.hero;
        if (r.id === 'hist') {
            UI.heroHistory(H, it);
        } else if (r.id === 'fresh') H.forItem('t', { series_id: it.id, name: it.name, tmdb: it.tmdb }, Icons.get('bell') + '<b>' + T('Nieuw') + '</b>');
        else if (r.id === 'favs') H.forItem(it._type === 'movie' ? 'm' : 't', it._type === 'movie' ? App.vodFromFav(it) : App.seriesFromFav(it));
        else if (r.id === 'chans') H.forChannel(it);
        else if (it.item) H.forItem(it.type, it.item);
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
            image: ep ? Meta.poster('t', { tmdb: h.series.tmdb }, h.series.icon) : Meta.poster('m', { tmdb: h.tmdb }, h.icon), imageName: ep ? h.series.name : h.name,
            progress: h.duration ? h.position / h.duration : 0,
            items: [
                { id: 'resume', label: h.upNext || !h.position ? T('Afspelen') : T('Verder kijken vanaf {time}', { time: U.fmtTime(h.position) }) },
                { id: 'start', label: T('Vanaf het begin') },
                { id: 'info', label: ep ? T('Naar de serie') : T('Filminformatie') },
                { id: 'del', label: T('Verwijderen uit Verder kijken'), danger: true }
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
            case 'up': if (!this.rows.move('up')) this.setZone('nav'); else this.updateHero(true); return true;
            case 'down': case 'left': case 'right': if (this.rows.move(k)) this.updateHero(k === 'down'); return true;
            case 'ok': this.rows.select(); return true;
            case 'longok':
                var r = this.rows.rows[this.rows.cur];
                if (r && r.id === 'hist') this.openHistory(r.list.current()); else this.rows.select();
                return true;
        }
        return false;
    }
};
