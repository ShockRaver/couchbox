/* Mijn lijst: films en series die je wilt (blijven) kijken */
Screens.mylist = {
    longOk: true,

    build: function () {
        this.el = UI.screen('mylist', 'nf nf-plain');
        this.nav = new TopNav('mylist');
        this.el.appendChild(this.nav.el);
        this.hint = U.h('div', { class: 'nf-hint' });
        this.el.appendChild(this.hint);
        var body = U.h('div', { class: 'home-body nf-body' });
        this.el.appendChild(body);
        this.rows = new RowStack(body);
        this.empty = U.h('div', { class: 'ml-empty', html: 'Je lijst is nog leeg.<br>Kies bij een film of serie <b>＋ Mijn lijst</b>, of houd OK ingedrukt op een poster.' });
        this.el.appendChild(this.empty);
    },

    show: function () { this.render(null); },
    resume: function () { this.render(this.rows.state()); },

    render: function (st) {
        var R = this.rows;
        var movies = Store.favorites('movie').reverse(), series = Store.favorites('series').reverse();
        R.clear();
        // Series met nieuwe afleveringen eerst
        series.sort(function (a, b) { return (Follow.hasFresh(b.id) ? 1 : 0) - (Follow.hasFresh(a.id) ? 1 : 0); });
        if (series.length) R.add({
            id: 'series', title: 'Series (' + series.length + ')', items: series, itemW: 200, itemH: 372,
            render: function (f) { return UI.posterCard({ name: f.name, icon: f.icon, rating: f.rating, tag: Follow.hasFresh(f.id) ? 'Nieuw' : '' }); },
            onSelect: function (f) { App.go('series', { item: App.seriesFromFav(f) }); }
        });
        if (movies.length) R.add({
            id: 'movies', title: 'Films (' + movies.length + ')', items: movies, itemW: 200, itemH: 372,
            render: function (f) {
                var h = Store.progress('movie:' + f.id);
                return UI.posterCard({ name: f.name, icon: f.icon, rating: f.rating, progress: h && h.duration ? h.position / h.duration : 0, seen: Store.isSeen('movie:' + f.id) });
            },
            onSelect: function (f) { App.go('movie', { item: App.vodFromFav(f) }); }
        });
        this.empty.style.display = R.rows.length ? 'none' : '';
        this.hint.textContent = R.rows.length ? 'OK ingedrukt houden: verwijderen uit Mijn lijst' : '';
        R.restore(st);
        this.setZone(R.rows.length ? (this.zone || 'rows') : 'nav');
    },

    setZone: function (z) { this.zone = z; this.nav.setFocus(z === 'nav'); this.rows.setActive(z === 'rows'); },
    navFocus: function (b) { this.setZone(b ? 'nav' : 'rows'); },

    onKey: function (k) {
        var self = this;
        if (this.zone === 'nav') {
            if (k === 'down') { if (this.rows.rows.length) this.setZone('rows'); return true; }
            if (k === 'longok') k = 'ok';
            return this.nav.key(k) || k === 'up';
        }
        if (k === 'up') { if (!this.rows.move('up')) this.setZone('nav'); return true; }
        if (k === 'down' || k === 'left' || k === 'right') { this.rows.move(k); return true; }
        if (k === 'ok') { this.rows.select(); return true; }
        if (k === 'longok' || k === 'red') {
            var r = this.rows.rows[this.rows.cur], f = r && r.list.current();
            if (!f) return true;
            var type = r.id === 'movies' ? 'movie' : 'series';
            Dialog.menu({ title: f.name, items: [{ id: 'open', label: 'Openen' }, { id: 'del', label: 'Verwijderen uit Mijn lijst', danger: true }] }, function (it) {
                if (!it) return;
                if (it.id === 'open') self.rows.select();
                else { App.toggleMyList(type, f); self.render(self.rows.state()); }
            });
            return true;
        }
        return false;
    }
};
