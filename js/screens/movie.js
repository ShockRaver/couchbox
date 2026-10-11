/* Filmdetails in streaming-stijl: backdrop, titel, rating/jaar/duur/genres, beschrijving en knoppen;
   daaronder cast & regie en "Meer zoals dit" (via de metadata-service, alleen titels uit jouw bibliotheek) */
Screens.movie = {
    build: function () {
        this.el = UI.screen('movie', 'detail detail2');
        this.bg = U.h('div', { class: 'detail-bg' });
        this.posterBox = U.h('div', { class: 'hero-poster' });
        this.title = U.h('h1');
        this.sub = U.h('div', { class: 'hero-sub' });
        this.meta = U.h('div', { class: 'meta' });
        this.plot = U.h('div', { class: 'plot' });
        this.credits = U.h('div', { class: 'credits' });
        this.btnBox = U.h('div', { class: 'detail-btns' });
        this.hero = U.h('div', { class: 'hero' }, [this.title, this.sub, this.meta, this.plot, this.credits, this.btnBox]);
        this.rowsBox = U.h('div', { class: 'detail-rows' });
        [this.bg, this.posterBox, this.hero, this.rowsBox].forEach(function (e) { this.el.appendChild(e); }, this);
        this.rows = new RowStack(this.rowsBox);
        this.bi = 0;
    },

    show: function (p) {
        var self = this, it = p.item;
        this.item = it;
        this.info = {};
        this.det = null;
        this.detFor = null;
        this.bi = 0;
        this.tmdbId = Tmdb.idOf(it);
        this.rows.clear();
        this.setZone('btns');
        this.render();
        this.loadDetails();
        Api.vodInfo(it.stream_id).then(function (res) {
            if (self.item !== it) return;
            self.info = res && res.info && !Array.isArray(res.info) ? res.info : {};
            var md = res && res.movie_data;
            if (md && md.container_extension) it.container_extension = md.container_extension;
            // Geen TMDB-id in de lijst (bv. vanuit Verder kijken)? De provider geeft hem vaak in de filminfo
            if (!self.tmdbId) { self.tmdbId = Tmdb.idOf({ tmdb: self.info.tmdb_id || self.info.tmdb }); self.loadDetails(); }
            self.render();
        }).catch(function () { /* details zijn optioneel */ });
    },

    resume: function () { this.render(); this.rows.rows.forEach(function (r) { r.list.refresh(); }); },

    loadDetails: function () {
        var self = this, it = this.item, id = this.tmdbId;
        if (!id || this.detFor === id) return;
        this.detFor = id;
        Meta.details('m', id).then(function (det) {
            if (self.item !== it || !det) return;
            self.det = det;
            self.render();
            self.buildRows();
        });
    },

    render: function () {
        var it = this.item, inf = this.info || {}, det = this.det, m = this.tmdbId ? Meta.byId('m', this.tmdbId) : null;
        var bd = (m && m.backdrop && Meta.img(m.backdrop, 'w1280')) || U.toArr(inf.backdrop_path)[0] || '';
        this.bg.style.backgroundImage = bd && /^https?:/i.test(bd) ? 'url("' + String(bd).replace(/"/g, '%22') + '")' : 'none';
        // Zonder backdrop: poster rechts tonen
        var poster = it.stream_icon || inf.movie_image || (m && Meta.img(m.poster, 'w500'));
        this.posterBox.innerHTML = '';
        if (!bd) this.posterBox.appendChild(U.img(poster, 'detail-poster', it.name));

        this.title.textContent = (m && m.title) || it.name;
        var subs = [];
        if (m && m.otitle && U.norm(m.otitle) !== U.norm(m.title)) subs.push(m.otitle);
        if (m && m.title && U.norm(m.title) !== U.norm(it.name)) subs.push(T('In je lijst als: {name}', { name: it.name }));
        this.sub.textContent = subs.join('  ·  ');

        var meta = [], r = Meta.rating('m', it) || parseFloat(inf.rating) || 0;
        if (r > 0) meta.push(UI.rating(r));
        var year = (m && m.year) || String(inf.releasedate || inf.release_date || '').slice(0, 4);
        if (/^\d{4}$/.test(String(year))) meta.push(U.esc(year));
        var dur = m && m.runtime ? App.durText(m.runtime * 60) : App.durText(inf.duration_secs, inf.duration);
        if (dur) meta.push(U.esc(dur));
        var genres = det && det.genres.length ? det.genres.slice(0, 3).join(', ') : inf.genre;
        if (genres) meta.push(U.esc(genres));
        this.meta.innerHTML = meta.join('<span class="dot">·</span>');

        this.plot.textContent = (det && det.overview) || inf.plot || inf.description || '';
        var cr = [];
        var dirs = det ? det.crew.filter(function (c) { return c.role === 'Regie'; }).map(function (c) { return c.name; }).join(', ') : inf.director;
        var cast = det ? det.cast.slice(0, 4).map(function (c) { return c.name; }).join(', ') : (inf.cast || inf.actors);
        if (dirs) cr.push(T('<b>Regie</b> {names}', { names: U.esc(dirs) }));
        if (cast) cr.push(T('<b>Met</b> {names}', { names: U.esc(cast) }));
        this.credits.innerHTML = cr.join('<br>');
        this.renderButtons();
    },

    buildRows: function () {
        var self = this, det = this.det, it = this.item;
        this.rows.clear();
        var people = det.crew.filter(function (c) { return c.role === 'Regie'; }).concat(det.cast);
        if (people.length) this.rows.add({
            id: 'cast', title: T('Cast & regie'), items: people, itemW: 190, itemH: 250,
            render: UI.personCard,
            onSelect: function (p) { App.go('person', { id: p.id, name: p.name }); }
        });
        this.rows.restore(null);
        this.rows.setActive(this.zone === 'rows');
        var addRow = function (o, at) {
            if (self.item !== it) return;
            var st = self.rows.state();
            o.at = at;
            self.rows.add(o);
            self.rows.restore(st);
            self.rows.setActive(self.zone === 'rows');
        };
        // Andere delen uit dezelfde reeks die jij hebt (direct onder de cast, vóór "Meer zoals dit")
        if (det.coll) Meta.collection(det.coll.id).then(function (c) {
            if (!c || !c.parts.length) return;
            var me = String(self.tmdbId);
            return Meta.inLibrary(c.parts.filter(function (x) { return String(x.id) !== me; }).map(function (x) { return { t: 'm', id: x.id }; })).then(function (list) {
                if (!list.length) return;
                addRow({
                    id: 'coll', title: T('Uit de reeks: {name}', { name: (c.name || det.coll.name).replace(/\s*(-\s*)?(collectie|collection|filmreeks)$/i, '') }), items: list, itemW: 200, itemH: 372,
                    render: function (x) { return UI.libCard(x.type, x.item); },
                    onSelect: function (x) { UI.openLib(x.type, x.item); }
                }, self.rows.rows.filter(function (r) { return r.id === 'cast'; }).length);
            });
        }).catch(function () { /* geen reeks */ });
        // "Meer zoals dit": TMDB-aanbevelingen die jij ook hebt (heeft de volledige filmlijst nodig)
        if (det.recs.length) Meta.inLibrary(det.recs.map(function (id) { return { t: 'm', id: id }; })).then(function (list) {
            if (self.item !== it || !list.length) return;
            var st = self.rows.state();
            self.rows.add({
                id: 'recs', title: T('Meer zoals dit'), items: list.slice(0, 30), itemW: 200, itemH: 372,
                render: function (x) { return UI.libCard(x.type, x.item); },
                onSelect: function (x) { UI.openLib(x.type, x.item); }
            });
            self.rows.restore(st);
            self.rows.setActive(self.zone === 'rows');
        }).catch(function () { /* geen aanbevelingen */ });
    },

    renderButtons: function () {
        var self = this, it = this.item, h = Store.progress('movie:' + it.stream_id), b = [];
        if (h && h.position > 30000) {
            b.push({ id: 'resume', label: T('Verder kijken vanaf {time}', { time: U.fmtTime(h.position) }), icon: 'play' });
            b.push({ id: 'start', label: T('Vanaf begin'), icon: 'restart' });
        } else b.push({ id: 'start', label: T('Afspelen'), icon: 'play' });
        var fav = Store.isFav('movie', it.stream_id);
        b.push({ id: 'fav', label: fav ? T('In Mijn lijst') : T('Mijn lijst'), icon: fav ? 'check' : 'plus', on: fav });
        b.push(UI.rateButton('m', this.rateItem()));
        if (this.det && this.det.trailer) b.push({ id: 'trailer', label: T('Trailer'), icon: 'film' });
        this.btns = b;
        this.bi = U.clamp(this.bi, 0, b.length - 1);
        this.btnBox.innerHTML = '';
        b.forEach(function (x, i) {
            self.btnBox.appendChild(U.h('div', { class: 'btn' + (self.zone === 'btns' && i === self.bi ? ' focus' : '') + (x.on ? ' on' : ''), html: Icons.get(x.icon) + '<span>' + U.esc(x.label) + '</span>' }));
        });
    },

    // Voor de beoordeling: film met het TMDB-id (ook als dat pas later bekend werd)
    rateItem: function () { return Object.assign({}, this.item, { tmdb: this.tmdbId || this.item.tmdb || '' }); },

    setZone: function (z) {
        this.zone = z;
        this.el.classList.toggle('rows-on', z === 'rows');
        this.rows.setActive(z === 'rows');
        if (this.btns) this.renderButtons();
    },

    play: function (startAt) {
        var it = this.item;
        App.go('player', { mode: 'movie', item: { id: it.stream_id, name: it.name, icon: it.stream_icon, ext: it.container_extension || 'mp4', tmdb: this.tmdbId || '' }, startAt: startAt });
    },

    onKey: function (k) {
        var h;
        if (this.zone === 'rows') {
            if (k === 'up') { if (!this.rows.move('up')) this.setZone('btns'); return true; }
            if (k === 'down' || k === 'left' || k === 'right') { this.rows.move(k); return true; }
            if (k === 'ok') { this.rows.select(); return true; }
            return false;
        }
        switch (k) {
            case 'left': case 'right':
                this.bi = U.clamp(this.bi + (k === 'left' ? -1 : 1), 0, this.btns.length - 1);
                this.renderButtons();
                return true;
            case 'down': if (this.rows.rows.length) this.setZone('rows'); return true;
            case 'play': case 'playpause':
                h = Store.progress('movie:' + this.item.stream_id);
                this.play(h ? h.position : 0);
                return true;
            case 'ok':
                var id = this.btns[this.bi].id;
                if (id === 'resume') { h = Store.progress('movie:' + this.item.stream_id); this.play(h ? h.position : 0); }
                else if (id === 'start') this.play(0);
                else if (id === 'trailer') App.trailer(this.det.trailer, this.title.textContent);
                else if (id === 'rate') { var self = this; UI.rateMenu('m', this.rateItem(), function () { self.renderButtons(); }); }
                else if (id === 'fav') {
                    App.toggleMyList('movie', App.favFromVod(Object.assign({}, this.item, { tmdb: this.tmdbId || this.item.tmdb })));
                    this.renderButtons();
                }
                return true;
        }
        return false;
    }
};
