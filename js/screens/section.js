/* Films / Series in streaming-stijl: menu, hero, en rijen (verder kijken, Mijn lijst, nieuw, één rij per genre).
   De oorspronkelijke categorieën van de provider zitten achter de knop "Categorieën". */
Screens.section = {
    longOk: true,
    ROW_MAX: 40, // titels per genre-rij

    build: function () {
        var self = this;
        this.el = UI.screen('section', 'nf');
        this.heroBox = U.h('div');
        this.hero = new Hero(this.heroBox);
        this.nav = new TopNav('movie');
        this.chip = U.h('div', { class: 'sec-chip', html: Icons.get('list') + '<span>' + T('Categorieën') + '</span>' });
        this.rowsBox = U.h('div', { class: 'nf-rows' });
        this.loading = U.h('div', { class: 'sec-loading', html: '<span class="spinner sm"></span><span></span>' });
        [this.heroBox, this.rowsBox, this.chip, this.loading, this.nav.el].forEach(function (e) { self.el.appendChild(e); });
        this.rows = new RowStack(this.rowsBox);
        // Nieuwe gegevens voor het geselecteerde item (bv. backdrop): kaarten in beeld verversen
        this.hero.onUpdate = function () { self.rows.rows.forEach(function (r) { if (r.id === 'hist') r.list.refresh(); }); };
        // Hero bijwerken als je even stilstaat; bij omhoog/omlaag iets langer wachten (dan scroll je vaak door)
        this.updateHero = function (slow) { clearTimeout(self.heroT); self.heroT = setTimeout(function () { self.showHero(); }, slow ? 350 : 180); };
    },

    show: function (p) {
        var self = this, movie = p.mode === 'movie', my = this.token = (this.token || 0) + 1;
        this.mode = p.mode;
        this.type = movie ? 'm' : 't';
        this.nav.active = p.mode;
        this.rows.clear();
        this.addPersonal();
        this.rows.restore(null);
        this.setZone(this.rows.rows.length ? 'rows' : 'nav');
        if (this.rows.rows.length) this.showHero();
        else this.hero.message(movie ? T('Films') : T('Series'), T('Genres worden geladen…'));
        this.loading.lastChild.textContent = movie ? T('Films laden bij je provider…') : T('Series laden bij je provider…');
        this.loading.style.display = '';
        // Eerst het scherm tekenen, dan pas laden (anders lijkt de knop even niets te doen)
        setTimeout(function () {
            if (my !== self.token) return;
            self.addReco(my);
            self.addSeason(my);
            (movie ? Api.vodCategories() : Api.seriesCategories()).then(function (cats) {
                if (my !== self.token) return;
                self.cats = cats;
                return self.addGenres(cats, my);
            }).catch(function (e) {
                if (my === self.token) self.hero.message(T('Laden mislukt'), e.message);
            }).then(function () { if (my === self.token) self.loading.style.display = 'none'; });
        }, 30);
    },

    resume: function () { this.rows.rows.forEach(function (r) { r.list.refresh(); }); this.rows.draw(); this.showHero(); },
    hide: function () { clearTimeout(this.heroT); },

    // Persoonlijke rijen: verder kijken, Mijn lijst, nieuwe afleveringen
    addPersonal: function () {
        var movie = this.mode === 'movie', type = this.type, R = this.rows;
        var hist = Store.history().filter(function (h) { return movie ? h.mode === 'movie' : h.mode === 'episode'; });
        if (hist.length) R.add({ id: 'hist', title: T('Verder kijken'), items: hist, itemW: 400, itemH: 290, render: UI.histCard, onSelect: function (h) { App.playHistory(h, h.position); } });
        if (!movie) {
            var fresh = Follow.fresh();
            if (fresh.length) R.add({
                id: 'fresh', title: T('Nieuwe afleveringen'), items: fresh, itemW: 184, itemH: 320,
                render: function (f) { return UI.posterCard({ small: true, name: f.name, icon: Meta.poster('t', f, f.icon), tag: T('Nieuw') }); },
                onSelect: function (f) { App.go('series', { item: { series_id: f.id, name: f.name, cover: f.icon, tmdb: f.tmdb || '' } }); }
            });
        }
        var mine = Store.favorites(this.mode).reverse().map(movie ? App.vodFromFav : App.seriesFromFav);
        if (mine.length) R.add({
            id: 'favs', title: T('Mijn lijst'), items: mine, itemW: 184, itemH: 320,
            render: function (it) { return UI.libCard(type, it, { small: true }); },
            onSelect: function (it) { UI.openLib(type, it); }
        });
    },

    // Aanbevelingen voor films of series: direct uit het geheugen, daarna ververst en op de juiste plek ingevoegd
    addReco: function (my) {
        var self = this, kind = this.type;
        var put = function (rows) {
            if (my !== self.token || !rows.length) return;
            var st = self.rows.state(), first = !self.rows.rows.length;
            var at = self.rows.rows.filter(function (r) { return r.reco || r.season || r.id === 'hist' || r.id === 'fresh' || r.id === 'favs'; }).length;
            rows.forEach(function (r) {
                if (self.rows.rows.some(function (x) { return x.id === r.id; })) return;
                self.rows.add(UI.recoRow(r, at++)).reco = true;
            });
            self.rows.restore(st);
            self.rows.setActive(self.zone === 'rows');
            if (first && self.rows.rows.length) { self.setZone('rows'); self.showHero(); }
        };
        put(Reco.cached(kind));
        if (Reco.stale(kind)) Reco.refresh(kind).then(put);
    },

    // Seizoensrij (Halloween, Kerst & Sinterklaas, Valentijn) vanaf 4 weken vóór de datum, direct na de persoonlijke rijen
    addSeason: function (my) {
        var self = this, type = this.type;
        Season.active().forEach(function (s) {
            Season.items(type, s).then(function (items) {
                if (my !== self.token || items.length < 3 || self.rows.rows.some(function (r) { return r.id === 'season:' + s.id; })) return;
                var st = self.rows.state(), first = !self.rows.rows.length;
                var at = self.rows.rows.filter(function (r) { return r.season || r.id === 'hist' || r.id === 'fresh' || r.id === 'favs'; }).length;
                self.rows.add({
                    id: 'season:' + s.id, title: T(s.name), items: items.slice(0, self.ROW_MAX), itemW: 184, itemH: 320, at: at,
                    render: function (it) { return UI.libCard(type, it, { small: true }); },
                    onSelect: function (it) { UI.openLib(type, it); }
                }).season = true;
                self.rows.restore(st);
                self.rows.setActive(self.zone === 'rows');
                if (first) { self.setZone('rows'); self.showHero(); }
            }).catch(function () { /* geen seizoensrij */ });
        });
    },

    // Eén rij per genre (achter elkaar geladen, zodat de volgorde vast is); plus "Nieuw toegevoegd" als de volledige lijst er is.
    // Volgorde per rij via Rank: recent uitgekomen, goed gewaardeerd en bekend eerst, en niet vooraan in meerdere rijen.
    addGenres: function (cats, my) {
        var self = this, movie = this.mode === 'movie', type = this.type, used = {};
        // "Kerst & Sinterklaas" komt als seizoensrij (alleen in de weken ervoor), niet als genre
        var genres = (movie ? Genres.movieGenres(cats) : Genres.LIST.filter(function (g) { return Screens.catalog.SERIES_GENRES.indexOf(g.id) >= 0; }))
            .filter(function (g) { return g.id !== 'feest'; });
        var add = function (id, title, items) {
            if (my !== self.token || !items.length) return;
            var st = self.rows.state(), first = !self.rows.rows.length;
            self.rows.add({
                id: id, title: title, items: items, itemW: 184, itemH: 320,
                render: function (it) { return UI.libCard(type, it, { small: true }); },
                onSelect: function (it) { UI.openLib(type, it); }
            });
            self.rows.restore(st);
            self.rows.setActive(self.zone === 'rows');
            if (first) { self.setZone('rows'); self.showHero(); }
        };
        // Series: de volledige lijst is toch nodig voor de genres, dus ook "Nieuw toegevoegd"
        var start = movie && !Api.loaded('vs:*') ? Promise.resolve() : Genres.all(this.type, cats).then(function (list) {
            add('new', T('Nieuw toegevoegd'), Rank.recent(type, list, used, self.ROW_MAX));
        }).catch(function () { /* geen "nieuw" */ });
        // Tussen de rijen even ruimte geven aan de TV (tekenen, toetsen), anders hapert het scherm
        var pause = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
        return genres.reduce(function (chain, g) {
            return chain.then(pause).then(function () {
                if (my !== self.token) return;
                return (movie ? Genres.movieItems(g.id, cats, true) : Genres.seriesItems(g.id, cats, true))
                    .then(function (items) { add('g:' + g.id, T(g.name), Rank.row(type, items, used, self.ROW_MAX)); })
                    .catch(function () { /* genre overslaan */ });
            });
        }, start);
    },

    showHero: function () {
        var r = this.rows.rows[this.rows.cur], it = r && r.list.current();
        if (!it) return;
        if (r.id === 'hist') UI.heroHistory(this.hero, it);
        else if (r.id === 'fresh') this.hero.forItem('t', { series_id: it.id, name: it.name, tmdb: it.tmdb }, Icons.get('bell') + '<b>' + T('Nieuw') + '</b>');
        else if (it.item) this.hero.forItem(it.type, it.item);
        else this.hero.forItem(this.type, it);
    },

    setZone: function (z) {
        this.zone = z;
        this.nav.setFocus(z === 'nav');
        this.chip.classList.toggle('focus', z === 'chip');
        this.rows.setActive(z === 'rows');
    },
    navFocus: function (b) { this.setZone(b ? 'nav' : 'rows'); },

    onKey: function (k) {
        if (k === 'longok') {
            // In rijen: OK ingedrukt = Mijn lijst toevoegen/verwijderen
            var r = this.rows.rows[this.rows.cur], it = r && r.list.current();
            if (this.zone === 'rows' && it && r.id !== 'hist' && r.id !== 'fresh') {
                var movie = this.mode === 'movie';
                if (it.item) it = it.item;   // aanbevelingsrij
                App.toggleMyList(this.mode, movie ? App.favFromVod(it) : App.favFromSeries(it));
                r.list.refreshItem(r.list.index);
                return true;
            }
            k = 'ok';
        }
        if (this.zone === 'nav') {
            if (k === 'down') { this.setZone('chip'); return true; }
            return this.nav.key(k) || k === 'up';
        }
        if (this.zone === 'chip') {
            if (k === 'up') { this.setZone('nav'); return true; }
            if (k === 'down') { if (this.rows.rows.length) this.setZone('rows'); return true; }
            if (k === 'ok') { App.go('catalog', { mode: this.mode }); return true; }
            return k === 'left' || k === 'right';
        }
        switch (k) {
            case 'up': if (!this.rows.move('up')) this.setZone('chip'); else this.updateHero(true); return true;
            case 'down': case 'left': case 'right': if (this.rows.move(k)) this.updateHero(k === 'down'); return true;
            case 'ok': this.rows.select(); return true;
        }
        return false;
    }
};
