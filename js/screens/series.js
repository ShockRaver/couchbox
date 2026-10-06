/* Seriedetails: info links, seizoenen en afleveringen rechts */
Screens.series = {
    build: function () {
        var self = this;
        this.el = UI.screen('series', 'detail series3');
        this.bg = U.h('div', { class: 'detail-bg' });
        this.posterBox = U.h('div', { class: 'series-poster-box' });
        this.titleEl = U.h('h1');
        this.metaEl = U.h('div', { class: 'meta' });
        this.plotEl = U.h('div', { class: 'plot' });
        this.btnBox = U.h('div', { class: 'series-btns' });
        this.seasonBox = U.h('div', { class: 'seasons' });
        this.epBox = U.h('div', { class: 'eps' });
        this.el.appendChild(this.bg);
        this.el.appendChild(U.h('div', { class: 'series-left' }, [this.posterBox, this.titleEl, this.metaEl, this.plotEl, this.btnBox]));
        this.el.appendChild(U.h('div', { class: 'series-right' }, [this.seasonBox, this.epBox]));
        this.seasons = new VList(this.seasonBox, { horizontal: true, itemW: 210, itemH: 64, pad: 8, render: function (s) { return U.h('div', { class: 'chip', text: s.name }); } });
        this.eps = new VList(this.epBox, { itemH: 150, pad: 8, render: function (e) { return self.renderEp(e); } });
    },

    show: function (p) {
        var self = this, it = p.item;
        this.item = it;
        this.id = String(it.series_id);
        this.data = null;
        this.det = null;
        this.detFor = null;
        this.detFailed = false;
        this.loadFailed = false;
        this.tmdbId = Tmdb.idOf(it);
        this.bi = 0;
        this.setInfo({});
        this.loadDetails();
        this.seasons.setItems([]);
        this.eps.setItems([]);
        this.eps.setEmpty('Afleveringen laden…');
        this.setZone('btns');
        Api.seriesInfo(it.series_id).then(function (res) {
            if (self.item !== it) return;
            self.data = App.parseSeries(res);
            self.raw = res;
            if (!self.tmdbId) { self.tmdbId = Tmdb.idOf({ tmdb: self.data.info.tmdb || self.data.info.tmdb_id }); self.loadDetails(); }
            // In Mijn lijst? Dan meteen een nulmeting voor "nieuwe afleveringen" (zonder extra verzoek)
            if (Store.isFav('series', it.series_id)) Follow.track({ id: it.series_id, name: it.name, icon: it.cover }, res);
            self.setInfo(self.data.info);
            self.seasons.setItems(self.data.seasons);
            self.eps.setEmpty('Geen afleveringen gevonden');
            self.focusTarget();
            self.renderButtons();
        }).catch(function (e) {
            if (self.item !== it) return;
            self.loadFailed = true;
            self.eps.setEmpty('Laden mislukt: ' + e.message);
            self.renderButtons();
        });
    },

    // Extra gegevens via de metadata-service (beschrijving, genres, cast)
    loadDetails: function () {
        var self = this, it = this.item, id = this.tmdbId;
        if (!id || this.detFor === id) return;
        this.detFor = id;
        Meta.details('t', id).then(function (det) {
            if (self.item !== it) return;
            if (!det) { self.detFailed = true; self.renderButtons(); return; }
            self.det = det;
            self.setInfo(self.data ? self.data.info : {});
        });
    },

    // Serie bekeken: nieuwe afleveringen niet meer als nieuw melden
    hide: function () { if (this.id) Follow.clear(this.id); },

    resume: function () {
        if (!this.data) return;
        this.focusTarget();
        this.renderButtons();
    },

    setInfo: function (inf) {
        var it = this.item, m = this.tmdbId ? Meta.byId('t', this.tmdbId) : null, det = this.det;
        var cover = inf.cover || it.cover || (m && Meta.img(m.poster, 'w342'));
        this.cover = cover;
        this.posterBox.innerHTML = '';
        this.posterBox.appendChild(U.img(cover, 'series-poster', it.name));
        var bd = (m && m.backdrop && Meta.img(m.backdrop, 'w1280')) || U.toArr(inf.backdrop_path || it.backdrop_path)[0] || cover;
        this.bg.style.backgroundImage = bd && /^https?:/i.test(bd) ? 'url("' + String(bd).replace(/"/g, '%22') + '")' : 'none';
        this.titleEl.textContent = (m && m.title) || it.name || inf.name || '';
        var meta = [], year = (m && m.year) || String(inf.releaseDate || inf.releasedate || it.releaseDate || '').slice(0, 4);
        var r = Meta.rating('t', Object.assign({ tmdb: this.tmdbId }, it)) || parseFloat(inf.rating) || 0;
        if (r > 0) meta.push(UI.rating(r));
        if (/^\d{4}$/.test(String(year))) meta.push(U.esc(year));
        var genres = det && det.genres.length ? det.genres.slice(0, 3).join(', ') : (inf.genre || it.genre);
        if (genres) meta.push(U.esc(genres));
        if (this.data) meta.push(this.data.seasons.length + (this.data.seasons.length === 1 ? ' seizoen' : ' seizoenen'));
        this.metaEl.innerHTML = meta.join('<span class="dot">·</span>');
        this.plotEl.textContent = (det && det.overview) || inf.plot || it.plot || '';
        this.renderButtons();
    },

    // Aflevering om verder te kijken: laatst bekeken, anders de eerste nog niet geziene
    target: function () {
        if (!this.data || !this.data.flat.length) return null;
        var id = this.id, flat = this.data.flat;
        var h = Store.history().filter(function (x) { return x.mode === 'episode' && x.series && String(x.series.id) === id; })[0];
        if (h) {
            var e = flat.filter(function (x) { return x.id === String(h.id); })[0];
            if (e) return { ep: e, pos: h.position, upNext: !!h.upNext };
        }
        var unseen = flat.filter(function (x) { return !Store.isSeen('episode:' + x.id); })[0];
        return { ep: unseen || flat[0], pos: 0 };
    },

    focusTarget: function () {
        var t = this.target();
        if (!t) return;
        var si = this.data.seasons.findIndex(function (s) { return s.num === t.ep.season; });
        if (si < 0) si = 0;
        this.seasons.focus(si);
        this.eps.setItems(this.data.seasons[si].eps, this.data.seasons[si].eps.indexOf(t.ep));
    },

    renderButtons: function () {
        // Alle knoppen staan er meteen (geen verspringen); wat nog laadt krijgt een spinner
        var self = this, t = this.target(), b = [];
        if (t) b.push({ id: 'play', icon: 'play', label: (t.upNext ? 'Volgende: ' : t.pos > 30000 ? 'Verder kijken ' : 'Afspelen ') + 'S' + t.ep.season + ' E' + t.ep.episode });
        else if (!this.data && !this.loadFailed) b.push({ id: 'play', icon: 'play', label: 'Afspelen', loading: true });
        var fav = Store.isFav('series', this.item.series_id);
        b.push({ id: 'fav', icon: fav ? 'check' : 'plus', label: fav ? 'In Mijn lijst' : 'Mijn lijst', on: fav });
        if (this.det) b.push({ id: 'cast', icon: 'user', label: 'Cast & meer zoals dit' });
        else if (this.tmdbId && !this.detFailed) b.push({ id: 'cast', icon: 'user', label: 'Cast & meer zoals dit', loading: true });
        this.btns = b;
        this.bi = U.clamp(this.bi, 0, b.length - 1);
        this.btnBox.innerHTML = '';
        b.forEach(function (x, i) {
            var cls = 'btn' + (self.zone === 'btns' && i === self.bi ? ' focus' : '') + (x.on ? ' on' : '') + (x.loading ? ' loading' : '');
            self.btnBox.appendChild(U.h('div', { class: cls, html: (x.loading ? '<span class="spinner sm"></span>' : Icons.get(x.icon)) + '<span>' + U.esc(x.label) + '</span>' }));
        });
    },

    renderEp: function (e) {
        var h = Store.progress('episode:' + e.id), seen = Store.isSeen('episode:' + e.id);
        var dur = App.durText(e.dur, e.durText);
        return U.h('div', { class: 'ep' }, [
            U.img(e.icon || this.cover, 'ep-thumb', e.name),
            U.h('div', { class: 'ep-main' }, [
                U.h('div', { class: 'ep-title' }, ['E' + e.episode + ' · ' + e.name, Follow.isFresh(this.id, e.id) ? U.h('span', { class: 'ep-new', text: 'NIEUW' }) : null]),
                U.h('div', { class: 'ep-meta', text: [dur, h ? 'nog ' + U.fmtTime(h.duration - h.position) : ''].filter(Boolean).join('  ·  ') }),
                e.plot ? U.h('div', { class: 'ep-plot', text: e.plot }) : null,
                h && h.duration ? UI.pbar(h.position / h.duration) : null
            ]),
            seen ? U.h('div', { class: 'ep-seen', html: Icons.get('check') }) : null
        ]);
    },

    setZone: function (z) {
        this.zone = z;
        this.seasons.setActive(z === 'seasons');
        this.eps.setActive(z === 'eps');
        this.renderButtons();
    },

    playEp: function (e, startAt) {
        var it = this.item;
        App.go('player', {
            mode: 'episode',
            item: { id: e.id, name: e.name, icon: e.icon || this.cover, ext: e.ext, season: e.season, episode: e.episode },
            series: { id: it.series_id, name: it.name, icon: this.cover, tmdb: this.tmdbId || '' },
            episodes: this.data.flat,
            startAt: startAt || 0
        });
    },

    askEp: function (e) {
        var self = this, h = Store.progress('episode:' + e.id);
        if (!h || h.position < 30000) return this.playEp(e, 0);
        Dialog.menu({ title: 'S' + e.season + ' E' + e.episode + ' · ' + e.name, items: [{ id: 'resume', label: 'Hervatten vanaf ' + U.fmtTime(h.position) }, { id: 'start', label: 'Vanaf begin' }] }, function (x) {
            if (x) self.playEp(e, x.id === 'resume' ? h.position : 0);
        });
    },

    onKey: function (k) {
        var hasEps = this.data && this.data.flat.length;
        if (this.zone === 'btns') {
            switch (k) {
                case 'up': case 'down':
                    this.bi = U.clamp(this.bi + (k === 'up' ? -1 : 1), 0, this.btns.length - 1);
                    this.renderButtons();
                    return true;
                case 'right': if (hasEps) this.setZone('eps'); return true;
                case 'ok':
                    var b = this.btns[this.bi];
                    if (b.loading) return true; // nog aan het laden
                    if (b.id === 'play') { var t = this.target(); if (t) this.playEp(t.ep, t.pos); }
                    else if (b.id === 'cast') App.go('credits', { type: 't', id: this.tmdbId, title: this.titleEl.textContent });
                    else if (b.id === 'fav') {
                        App.toggleMyList('series', App.favFromSeries(Object.assign({}, this.item, { cover: this.cover, tmdb: this.tmdbId || this.item.tmdb })), this.raw);
                        this.renderButtons();
                    }
                    return true;
            }
            return false;
        }
        if (this.zone === 'seasons') {
            switch (k) {
                case 'left':
                    if (!this.seasons.move('left')) { this.setZone('btns'); return true; }
                    this.eps.setItems(this.seasons.current().eps, 0);
                    return true;
                case 'right':
                    if (this.seasons.move('right')) this.eps.setItems(this.seasons.current().eps, 0);
                    return true;
                case 'down': case 'ok': if (this.eps.items.length) this.setZone('eps'); return true;
                case 'up': return true;
            }
            return false;
        }
        switch (k) {
            case 'up': if (!this.eps.move('up')) this.setZone('seasons'); return true;
            case 'down': this.eps.move('down'); return true;
            case 'chup': case 'chdown': this.eps.page(k === 'chup' ? -1 : 1); return true;
            case 'left': this.setZone('btns'); return true;
            case 'right': return true;
            case 'ok': case 'play': var e = this.eps.current(); if (e) this.askEp(e); return true;
        }
        return false;
    }
};
