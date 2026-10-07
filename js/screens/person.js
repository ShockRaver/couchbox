/* Persoonspagina (acteur/regisseur): foto en bio links, rechts alles van deze persoon dat in jouw bibliotheek staat */
Screens.person = {
    build: function () {
        this.el = UI.screen('person', 'detail');
        this.photo = U.h('div', { class: 'person-photo-box' });
        this.nameEl = U.h('h1');
        this.metaEl = U.h('div', { class: 'meta' });
        this.bioEl = U.h('div', { class: 'plot person-bio' });
        this.el.appendChild(U.h('div', { class: 'person-left' }, [this.photo, this.nameEl, this.metaEl, this.bioEl]));
        this.rowsBox = U.h('div', { class: 'person-rows' });
        this.status = U.h('div', { class: 'ml-empty' });
        this.rowsBox.appendChild(this.status);
        this.el.appendChild(this.rowsBox);
        this.rows = new RowStack(this.rowsBox);
    },

    show: function (p) {
        var self = this, id = p.id;
        this.pid = id;
        this.rows.clear();
        this.nameEl.textContent = p.name || '';
        this.metaEl.textContent = '';
        this.bioEl.textContent = '';
        this.photo.innerHTML = '';
        this.photo.appendChild(U.img('', 'person-photo', p.name));
        this.setStatus(T('Laden…'));
        Meta.person(id).then(function (pers) {
            if (self.pid !== id) return;
            if (!pers) { self.setStatus(T('Geen gegevens gevonden')); return; }
            self.photo.innerHTML = '';
            self.photo.appendChild(U.img(Meta.img(pers.img, 'w342'), 'person-photo', pers.name));
            self.nameEl.textContent = pers.name;
            var meta = [];
            var DEPT = { Acting: T('Acteur'), Directing: T('Regisseur'), Writing: T('Schrijver'), Production: T('Producent') };
            if (pers.dept) meta.push(DEPT[pers.dept] || pers.dept);
            if (pers.born) meta.push(T('Geboren {year}', { year: pers.born.slice(0, 4) }));
            self.metaEl.textContent = meta.join('  ·  ');
            self.bioEl.textContent = pers.bio;
            self.setStatus(T('Je bibliotheek doorzoeken…'));
            return Meta.inLibrary(pers.credits.sort(function (a, b) { return b.pop - a.pop; })).then(function (list) {
                if (self.pid !== id) return;
                self.fill(pers, list);
            });
        }).catch(function (e) { if (self.pid === id) self.setStatus(T('Laden mislukt: {error}', { error: e.message })); });
    },

    resume: function () { this.rows.rows.forEach(function (r) { r.list.refresh(); }); this.rows.draw(); },

    setStatus: function (t) { this.status.innerHTML = U.esc(t || ''); this.status.style.display = t ? '' : 'none'; },

    fill: function (pers, list) {
        var movies = list.filter(function (x) { return x.type === 'm'; }), series = list.filter(function (x) { return x.type === 't'; });
        var card = function (x) { return UI.libCard(x.type, x.item, { sub: x.role }); };
        var open = function (x) { UI.openLib(x.type, x.item); };
        this.rows.clear();
        if (movies.length) this.rows.add({ id: 'm', title: T('Films in je bibliotheek ({n})', { n: movies.length }), items: movies, itemW: 200, itemH: 372, render: card, onSelect: open });
        if (series.length) this.rows.add({ id: 't', title: T('Series in je bibliotheek ({n})', { n: series.length }), items: series, itemW: 200, itemH: 372, render: card, onSelect: open });
        this.setStatus(list.length ? '' : T('Niets van {name} in je bibliotheek', { name: pers.name }));
        this.rows.restore(null);
        this.rows.setActive(true);
    },

    onKey: function (k) {
        if (k === 'up' || k === 'down' || k === 'left' || k === 'right') { this.rows.move(k); return true; }
        if (k === 'ok') { this.rows.select(); return true; }
        return false;
    }
};
