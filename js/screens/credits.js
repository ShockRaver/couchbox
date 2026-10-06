/* Cast, makers en "Meer zoals dit" voor een serie (vanuit de seriepagina) */
Screens.credits = {
    build: function () {
        this.el = UI.screen('credits');
        this.hdr = UI.header('');
        this.el.appendChild(this.hdr.el);
        var body = U.h('div', { class: 'home-body' });
        this.status = U.h('div', { class: 'ml-empty' });
        body.appendChild(this.status);
        this.el.appendChild(body);
        this.rows = new RowStack(body);
    },

    show: function (p) {
        var self = this, key = p.type + ':' + p.id;
        this.key = key;
        this.hdr.title.textContent = p.title || '';
        this.hdr.sub.textContent = 'Cast & meer zoals dit';
        this.rows.clear();
        this.status.textContent = 'Laden…';
        this.status.style.display = '';
        Meta.details(p.type, p.id).then(function (det) {
            if (self.key !== key) return;
            if (!det) { self.status.textContent = 'Geen gegevens gevonden'; return; }
            var person = function (x) { App.go('person', { id: x.id, name: x.name }); };
            if (det.crew.length) self.rows.add({ id: 'crew', title: 'Makers', items: det.crew, itemW: 190, itemH: 250, render: UI.personCard, onSelect: person });
            if (det.cast.length) self.rows.add({ id: 'cast', title: 'Cast', items: det.cast, itemW: 190, itemH: 250, render: UI.personCard, onSelect: person });
            self.status.style.display = self.rows.rows.length ? 'none' : '';
            self.status.textContent = 'Geen cast bekend';
            self.rows.restore(null);
            self.rows.setActive(true);
            return Meta.inLibrary(det.recs.map(function (id) { return { t: p.type, id: id }; })).then(function (list) {
                if (self.key !== key || !list.length) return;
                var st = self.rows.state();
                self.rows.add({
                    id: 'recs', title: 'Meer zoals dit', items: list.slice(0, 30), itemW: 200, itemH: 372,
                    render: function (x) { return UI.libCard(x.type, x.item); },
                    onSelect: function (x) { UI.openLib(x.type, x.item); }
                });
                self.status.style.display = 'none';
                self.rows.restore(st);
                self.rows.setActive(true);
            });
        }).catch(function (e) { if (self.key === key) self.status.textContent = 'Laden mislukt: ' + e.message; });
    },

    resume: function () { this.rows.draw(); },

    onKey: function (k) {
        if (k === 'up' || k === 'down' || k === 'left' || k === 'right') { this.rows.move(k); return true; }
        if (k === 'ok') { this.rows.select(); return true; }
        return false;
    }
};
