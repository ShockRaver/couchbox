/* Films- of seriesoverzicht: categorieën links, postergrid rechts */
Screens.catalog = {
    longOk: true,
    // Genres die bij series voorkomen (TMDB-seriegenres + genres uit categorienamen)
    SERIES_GENRES: ['actie', 'avontuur', 'animatie', 'kids', 'familie', 'komedie', 'drama', 'romantiek', 'thriller', 'misdaad',
        'horror', 'scifi', 'fantasy', 'oorlog', 'western', 'docu', 'reality', 'programma', 'soap', 'nieuws'],

    build: function () {
        var self = this;
        this.el = UI.screen('catalog');
        this.hdr = UI.header(T('Films'));
        this.el.appendChild(this.hdr.el);
        this.catBox = U.h('div', { class: 'col col-cats' });
        this.gridBox = U.h('div', { class: 'grid-box' });
        this.status = U.h('div', { class: 'grid-status' });
        this.gridBox.appendChild(this.status);
        this.el.appendChild(U.h('div', { class: 'cat-body' }, [this.catBox, this.gridBox]));
        this.cats = new VList(this.catBox, {
            itemH: 72, pad: 10,
            render: function (c) {
                if (c.header) return U.h('div', { class: 'cat-hdr', text: c.name });
                return U.h('div', { class: 'cat' + (c.genre ? ' genre' : '') + (c.action ? ' action' : '') }, [
                    c.id === 'fav' ? U.h('span', { class: 'cat-ic', html: Icons.get('star') }) : null,
                    c.action ? U.h('span', { class: 'cat-ic', html: Icons.get('restart') }) : null,
                    U.h('span', { class: 'cat-name', text: c.name })
                ]);
            }
        });
        this.grid = new VList(this.gridBox, { cols: 7, itemW: 200, itemH: 372, pad: 14, render: function (it) { return self.renderCard(it); } });
        this.lastCat = {};
        UI.addNav(this, 'movie');
    },

    show: function (p) {
        var self = this;
        this.mode = p.mode;
        var movie = this.mode === 'movie';
        this.hdr.title.textContent = movie ? T('Films: categorieën') : T('Series: categorieën');
        this.nav.active = this.mode;
        this.nav.draw();
        this.hdr.sub.textContent = '';
        this.catList = null;
        this.cats.setItems([]);
        this.grid.setItems([]);
        this.setStatus('');
        Loader.show(T('Categorieën laden…'));
        (movie ? Api.vodCategories() : Api.seriesCategories()).then(function (cats) {
            Loader.hide();
            var adult = App.adultIds(cats);
            self.adult = adult;
            self.cats_raw = cats;
            var list = [{ id: 'fav', name: T('Mijn lijst') }];
            if (movie) list.push({ id: 'cont', name: T('Verder kijken') });
            list.push({ id: 'all', name: movie ? T('Alle films') : T('Alle series') });
            list.push({ id: 'refresh', name: T('Lijst vernieuwen'), action: true });
            // Genres over alle categorieën heen (films: via categorienamen, series: via genre per serie)
            var genres = movie ? Genres.movieGenres(cats) : Genres.LIST.filter(function (g) { return self.SERIES_GENRES.indexOf(g.id) >= 0; });
            if (genres.length) {
                list.push({ header: true, name: T('Genres') });
                genres.forEach(function (g) { list.push({ id: 'g:' + g.id, name: T(g.name), genre: g.id }); });
            }
            list.push({ header: true, name: T('Categorieën van provider') });
            cats.forEach(function (c) {
                var id = String(c.category_id);
                if (!(adult && adult[id])) list.push({ id: id, name: c.category_name });
            });
            self.catList = list;
            var saved = self.lastCat[self.mode], start = saved ? list.findIndex(function (c) { return !c.header && c.id === saved; }) : -1;
            if (start < 0) start = Store.favorites(self.mode).length ? 0 : list.findIndex(function (c) { return c.genre; });
            if (start < 0) start = list.findIndex(function (c) { return !c.header && c.id !== 'fav' && c.id !== 'cont' && c.id !== 'all'; });
            if (start < 0) start = 0;
            self.cats.setItems(list, start);
            self.setZone('cats');
            self.loadCat(list[start]);
        }).catch(function (e) {
            Loader.hide();
            Dialog.alert(T('Laden mislukt'), e.message, function () { App.back(); });
        });
    },

    resume: function () {
        if (!this.catList) return;
        if (this.cat && (this.cat.id === 'fav' || this.cat.id === 'cont')) this.loadCat(this.cat, this.grid.index);
        else this.grid.refresh();
    },

    hide: function () { clearTimeout(this.catT); },

    setStatus: function (t) { this.status.textContent = t || ''; this.status.style.display = t ? '' : 'none'; },

    loadCat: function (cat, keepIndex) {
        var self = this, movie = this.mode === 'movie', my = this.token = (this.token || 0) + 1, p;
        this.cat = cat;
        this.lastCat[this.mode] = cat.id;
        this.grid.setItems([]);
        this.setStatus(T('Laden…'));
        if (cat.id === 'fav') p = Promise.resolve(Store.favorites(this.mode).map(movie ? App.vodFromFav : App.seriesFromFav));
        else if (cat.id === 'cont') p = Promise.resolve(Store.history().filter(function (h) { return h.mode === 'movie'; }).map(function (h) {
            return { stream_id: h.id, name: h.name, stream_icon: h.icon, container_extension: h.ext };
        }));
        else if (cat.genre) {
            // Series-genres hebben de volledige serielijst nodig; de eerste keer duurt dat even
            this.setStatus(movie && !Tmdb.hasData('m') ? T('Laden…') : T('Genres opbouwen… (de eerste keer kan dit even duren)'));
            p = movie ? Genres.movieItems(cat.genre, this.cats_raw) : Genres.seriesItems(cat.genre, this.cats_raw);
        }
        else p = movie ? Api.vodStreams(cat.id === 'all' ? null : cat.id) : Api.series(cat.id === 'all' ? null : cat.id);
        p.then(function (items) {
            if (my !== self.token) return;
            if (self.adult && (cat.id === 'all' || cat.genre)) items = items.filter(function (x) { return !App.inCats(x, self.adult); });
            if (Store.settings().hideAdult) items = items.filter(function (x) { return String(x.is_adult) !== '1'; });
            self.items = items;
            self.grid.setItems(items, keepIndex || 0);
            self.setStatus(items.length ? '' : cat.id === 'fav' ? T('Je lijst is nog leeg. Houd OK ingedrukt op een poster om hem toe te voegen.')
                : cat.genre ? (movie ? T('Geen films gevonden in dit genre') : T('Geen series gevonden in dit genre')) : T('Geen items in deze categorie'));
            self.hdr.sub.textContent = cat.name + ' · ' + items.length;
            // Filmgenre getoond op basis van categorieën: zodra de volledige lijst binnen is, aanvullen met TMDB
            if (cat.genre && movie && Tmdb.hasData('m') && !Api.loaded('vs:*')) {
                self.hdr.sub.textContent += ' · ' + T('meer titels worden geladen…');
                Api.vodStreams(null).then(function () {
                    if (my === self.token && self.cat === cat) self.loadCat(cat, self.grid.index);
                }).catch(function () { if (my === self.token) self.hdr.sub.textContent = cat.name + ' · ' + items.length; });
            }
        }).catch(function (e) {
            if (my === self.token) self.setStatus(T('Laden mislukt: {error}', { error: e.message }));
        });
    },

    renderCard: function (it) {
        var movie = this.mode === 'movie', id = movie ? it.stream_id : it.series_id;
        var h = movie ? Store.progress('movie:' + id) : null;
        return UI.posterCard({
            name: it.name, icon: Meta.poster(movie ? 'm' : 't', it, movie ? it.stream_icon : it.cover), rating: Meta.rating(movie ? 'm' : 't', it),
            fav: Store.isFav(this.mode, id),
            progress: h && h.duration ? h.position / h.duration : 0,
            seen: movie && Store.isSeen('movie:' + id)
        });
    },

    setZone: function (z) {
        this.zone = z;
        this.cats.setActive(z === 'cats');
        this.grid.setActive(z === 'grid');
    },

    // Kopjes ("Genres", "Categorieën van provider") overslaan bij het navigeren
    moveCat: function (k) {
        var from = this.cats.index;
        this.cats.move(k);
        while (this.cats.current() && this.cats.current().header) {
            if (!this.cats.move(k)) { this.cats.focus(from); break; }
        }
        return this.cats.index !== from;
    },

    schedCat: function () {
        var self = this;
        clearTimeout(this.catT);
        // Actie-items (vernieuwen) alleen met OK uitvoeren, niet bij het er langs scrollen
        this.catT = setTimeout(function () { var c = self.cats.current(); if (c && !c.action && c !== self.cat) self.loadCat(c); }, 350);
    },

    open: function (it) {
        if (this.mode === 'movie') App.go('movie', { item: it });
        else App.go('series', { item: it });
    },

    toggleFav: function (it) {
        var movie = this.mode === 'movie';
        App.toggleMyList(this.mode, movie ? App.favFromVod(it) : App.favFromSeries(it));
        if (this.cat.id === 'fav') this.loadCat(this.cat, this.grid.index); else this.grid.refreshItem(this.grid.index);
    },

    onKey: function (k) {
        var self = this;
        if (!this.catList) return false;
        if (this.zone === 'cats') {
            switch (k) {
                case 'up': case 'down':
                    if (this.moveCat(k)) this.schedCat(); else if (k === 'up') this.navFocus(true);
                    return true;
                case 'chup': case 'chdown':
                    this.cats.page(k === 'chup' ? -1 : 1);
                    if (this.cats.current().header) this.moveCat(k === 'chup' ? 'up' : 'down');
                    this.schedCat();
                    return true;
                case 'right': case 'ok': case 'longok':
                    clearTimeout(this.catT);
                    if (this.cats.current().action) {
                        if (k !== 'right') App.refreshCatalog(function () { Screens.catalog.show({ mode: self.mode }); });
                        return true;
                    }
                    if (this.cats.current() !== this.cat) this.loadCat(this.cats.current());
                    if (this.grid.items.length) this.setZone('grid');
                    return true;
            }
            return false;
        }
        var it = this.grid.current();
        switch (k) {
            case 'up': if (!this.grid.move(k)) this.navFocus(true); return true;
            case 'down': case 'right': this.grid.move(k); return true;
            case 'left': if (!this.grid.move('left')) this.setZone('cats'); return true;
            case 'chup': case 'chdown': this.grid.page(k === 'chup' ? -1 : 1); return true;
            case 'back': this.setZone('cats'); return true;
            case 'ok': if (it) this.open(it); return true;
            case 'red': if (it) this.toggleFav(it); return true;
            case 'longok':
                if (!it) return true;
                var fav = Store.isFav(this.mode, this.mode === 'movie' ? it.stream_id : it.series_id);
                Dialog.menu({ title: it.name, items: [{ id: 'open', label: T('Openen') }, { id: 'fav', label: fav ? T('Verwijderen uit Mijn lijst') : '＋ ' + T('Mijn lijst') }] }, function (x) {
                    if (x && x.id === 'open') self.open(it);
                    else if (x && x.id === 'fav') self.toggleFav(it);
                });
                return true;
        }
        return false;
    }
};
