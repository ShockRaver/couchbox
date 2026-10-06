/* Zoeken in zenders, films en series */
Screens.search = {
    build: function () {
        var self = this;
        this.el = UI.screen('search', 'nf nf-plain');
        this.nav = new TopNav('search');
        this.el.appendChild(this.nav.el);
        this.input = U.h('input', { type: 'search', placeholder: 'Typ een titel of zendernaam…', autocomplete: 'off', spellcheck: 'false' });
        this.field = U.h('div', { class: 'field search-field', html: Icons.get('search') }, this.input);
        this.status = U.h('div', { class: 'search-status' });
        var rowsBox = U.h('div', { class: 'search-rows' });
        this.el.appendChild(U.h('div', { class: 'search-top' }, [this.field, this.status]));
        this.el.appendChild(rowsBox);
        this.rows = new RowStack(rowsBox);
        this.input.addEventListener('input', U.debounce(function () { self.run(); }, 450));
        this.data = null;
    },

    show: function () {
        var self = this;
        this.setZone('input');
        this.run();
        if (this.data) return;
        this.setStatus('Catalogus laden voor zoeken… (kan even duren bij grote abonnementen)');
        var safe = function (p) { return p.catch(function () { return []; }); };
        Promise.all([safe(Api.liveStreams()), safe(Api.vodStreams(null)), safe(Api.series(null)),
            safe(Api.liveCategories()), safe(Api.vodCategories()), safe(Api.seriesCategories())]).then(function (r) {
            var a = [App.adultIds(r[3]), App.adultIds(r[4]), App.adultIds(r[5])];
            var f = function (list, ad) { return ad ? list.filter(function (x) { return !App.inCats(x, ad); }) : list; };
            self.data = { live: f(r[0], a[0]), movie: f(r[1], a[1]), series: f(r[2], a[2]) };
            self.setStatus('');
            self.run();
        });
    },

    resume: function () { this.rows.draw(); this.rows.rows.forEach(function (r) { r.list.refresh(); }); },

    setStatus: function (t) { this.status.textContent = t || ''; },

    setZone: function (z) {
        this.zone = z;
        this.nav.setFocus(z === 'nav');
        this.field.classList.toggle('focus', z === 'input');
        this.rows.setActive(z === 'rows');
    },
    navFocus: function (b) { this.setZone(b ? 'nav' : 'input'); },

    run: function () {
        var self = this, q = U.norm(this.input.value).trim(), terms = q.split(/\s+/).filter(Boolean);
        var st = this.rows.state();
        this.rows.clear();
        if (!this.data || q.length < 2) {
            if (this.data) this.setStatus(q.length ? 'Typ minimaal 2 tekens' : 'Druk op OK om te typen');
            return;
        }
        function find(list) {
            var out = [];
            for (var i = 0; i < list.length && out.length < 80; i++) {
                var it = list[i], n = it._n || (it._n = U.norm(it.name));
                if (terms.every(function (t) { return n.indexOf(t) >= 0; })) out.push(it);
            }
            return out;
        }
        var live = find(this.data.live), movies = find(this.data.movie), series = find(this.data.series);
        if (live.length) this.rows.add({
            id: 'live', title: 'Zenders (' + live.length + ')', items: live, itemW: 250, itemH: 214,
            render: function (c) { return UI.logoCard(c); },
            onSelect: function (c, i, items) { App.go('player', { mode: 'live', channel: c, list: items }); }
        });
        if (movies.length) this.rows.add({
            id: 'movie', title: 'Films (' + movies.length + ')', items: movies, itemW: 200, itemH: 372,
            render: function (m) { return UI.posterCard({ name: m.name, icon: m.stream_icon, rating: m.rating, fav: Store.isFav('movie', m.stream_id) }); },
            onSelect: function (m) { App.go('movie', { item: m }); }
        });
        if (series.length) this.rows.add({
            id: 'series', title: 'Series (' + series.length + ')', items: series, itemW: 200, itemH: 372,
            render: function (s) { return UI.posterCard({ name: s.name, icon: s.cover, rating: s.rating, fav: Store.isFav('series', s.series_id) }); },
            onSelect: function (s) { App.go('series', { item: s }); }
        });
        this.rows.restore(st);
        this.rows.setActive(this.zone === 'rows');
        this.setStatus(this.rows.rows.length ? '' : 'Niets gevonden voor "' + this.input.value.trim() + '"');
    },

    onKey: function (k) {
        if (this.zone === 'nav') {
            if (k === 'down') { this.setZone('input'); return true; }
            return this.nav.key(k) || k === 'up';
        }
        if (this.zone === 'input') {
            switch (k) {
                case 'ok': this.input.focus(); return true;
                case 'inputdone': this.run(); if (this.rows.rows.length) this.setZone('rows'); return true;
                case 'down': if (this.rows.rows.length) this.setZone('rows'); return true;
                case 'up': this.setZone('nav'); return true;
            }
            return false;
        }
        switch (k) {
            case 'up': if (!this.rows.move('up')) this.setZone('input'); return true;
            case 'down': case 'left': case 'right': this.rows.move(k); return true;
            case 'ok': this.rows.select(); return true;
        }
        return false;
    }
};
