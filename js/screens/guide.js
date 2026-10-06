/* TV-gids: tijdlijn per zender (EPG-raster) */
Screens.guide = {
    WIN: 180,              // minuten zichtbaar in het venster
    CH_W: 340,             // breedte zenderkolom (px, incl. marge)
    AREA_W: 1500,          // breedte van het tijdvak (px)

    build: function () {
        var self = this;
        this.el = UI.screen('guide');
        this.hdr = UI.header('TV-gids');
        this.el.appendChild(this.hdr.el);
        this.dTitle = U.h('div', { class: 'g-dtitle' });
        this.dMeta = U.h('div', { class: 'g-dmeta' });
        this.dDesc = U.h('div', { class: 'g-ddesc' });
        this.el.appendChild(U.h('div', { class: 'g-detail' }, [this.dMeta, this.dTitle, this.dDesc]));
        this.times = U.h('div', { class: 'g-times' });
        this.el.appendChild(this.times);
        this.nowLine = U.h('div', { class: 'g-now' });
        this.el.appendChild(this.nowLine);
        this.rowsBox = U.h('div', { class: 'g-rows' });
        this.el.appendChild(this.rowsBox);
        this.list = new VList(this.rowsBox, { itemH: 88, render: function (c, i) { return self.renderRow(c, i); } });
        this.list.setEmpty('Geen zenders');
        UI.addNav(this, 'guide');
    },

    px: function () { return this.AREA_W / this.WIN; },
    floor30: function (t) { var d = new Date(t); d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0); return d.getTime(); },

    show: function (p) {
        var self = this;
        this.list.setItems([]);
        if (p.items) return this.setup(p.items, p.index || 0, p.catName);
        // Vanaf het startscherm: favorieten, anders de laatst gekozen categorie
        Loader.show('TV-gids laden…');
        Promise.all([Api.liveCategories(), Api.liveStreams()]).then(function (r) {
            Loader.hide();
            var adult = App.adultIds(r[0]);
            var all = adult ? r[1].filter(function (s) { return !App.inCats(s, adult); }) : r[1];
            var favs = Store.favorites('live');
            if (favs.length) {
                var byId = {};
                all.forEach(function (s) { byId[s.stream_id] = s; });
                return self.setup(favs.map(function (f) { return byId[f.id] || App.chFromFav(f); }), 0, 'Favorieten');
            }
            var cat = Store.liveCat(), catObj = r[0].filter(function (c) { return String(c.category_id) === cat; })[0];
            var items = catObj ? all.filter(function (s) { return App.catIds(s).indexOf(cat) >= 0; }) : all;
            self.setup(items, 0, catObj ? catObj.category_name : 'Alle zenders');
        }).catch(function (e) {
            Loader.hide();
            Dialog.alert('TV-gids laden mislukt', e.message, function () { App.back(); });
        });
    },

    setup: function (items, index, catName) {
        var self = this;
        this.items = items;
        this.win = this.floor30(Date.now());
        this.ft = Date.now();
        this.hdr.sub.textContent = (catName || '') + ' · ' + items.length + ' zenders';
        this.list.setActive(true);
        this.list.setItems(items, index);
        this.syncProg();
        this.draw();
        this.requestEpg();
        clearInterval(this.tick);
        this.tick = setInterval(function () { self.drawTimes(); }, 30000);
    },

    resume: function () { if (this.items) { this.draw(); this.requestEpg(); } },
    hide: function () { clearInterval(this.tick); clearTimeout(this.epgT); },

    progs: function (ch) { return ch ? EPG.get(ch.stream_id) : null; },

    // Programma in de huidige rij dat op het focus-tijdstip loopt
    syncProg: function () {
        var l = this.progs(this.list.current()), ft = this.ft;
        this.pi = -1;
        if (!l || !l.length) return;
        var i = l.findIndex(function (p) { return p.end > ft; });
        this.pi = i < 0 ? l.length - 1 : i;
    },

    renderRow: function (ch, i) {
        var self = this, px = this.px(), ws = this.win, we = ws + this.WIN * 60000, now = Date.now();
        var area = U.h('div', { class: 'g-area' });
        var l = this.progs(ch), focusRow = i === this.list.index;
        if (!l || !l.length) {
            area.appendChild(U.h('div', { class: 'g-prog empty', style: { left: '0px', width: (this.AREA_W - 4) + 'px' }, text: l ? 'Geen programmagegevens' : 'Laden…' }));
        } else {
            l.forEach(function (p, j) {
                if (p.end <= ws || p.start >= we) return;
                var a = Math.max(p.start, ws), b = Math.min(p.end, we);
                var cls = 'g-prog' + (p.start <= now && p.end > now ? ' g-live' : '') + (focusRow && j === self.pi ? ' focus' : '');
                area.appendChild(U.h('div', { class: cls, style: { left: ((a - ws) / 60000 * px) + 'px', width: Math.max(2, (b - a) / 60000 * px - 4) + 'px' } }, [
                    U.h('div', { class: 'g-t', text: p.title }),
                    U.h('div', { class: 'g-tm', text: U.fmtClock(p.start) + ' – ' + U.fmtClock(p.end) })
                ]));
            });
        }
        return U.h('div', { class: 'g-row' }, [
            U.h('div', { class: 'g-ch' }, [
                U.h('span', { class: 'g-num', text: ch.num != null ? String(ch.num) : '' }),
                U.img(ch.stream_icon, 'g-logo', ch.name),
                U.h('span', { class: 'g-name', text: ch.name })
            ]),
            area
        ]);
    },

    draw: function () { this.drawTimes(); this.list.refresh(); this.updateDetail(); },

    drawTimes: function () {
        var px = this.px(), x0 = this.CH_W;
        this.times.innerHTML = '';
        for (var t = this.win; t < this.win + this.WIN * 60000; t += 30 * 60000) {
            this.times.appendChild(U.h('div', { class: 'g-time', style: { left: (x0 + (t - this.win) / 60000 * px) + 'px' }, text: U.fmtClock(t) }));
        }
        this.times.appendChild(U.h('div', { class: 'g-day', text: U.fmtDate(this.win) }));
        var now = Date.now();
        var inWin = now >= this.win && now < this.win + this.WIN * 60000;
        this.nowLine.style.display = inWin ? '' : 'none';
        // g-rows begint op left: 40px
        this.nowLine.style.left = (40 + x0 + (now - this.win) / 60000 * px) + 'px';
    },

    updateDetail: function () {
        var ch = this.list.current(), l = this.progs(ch), p = l && this.pi >= 0 ? l[this.pi] : null;
        if (!ch) { this.dTitle.textContent = ''; this.dMeta.textContent = ''; this.dDesc.textContent = ''; return; }
        this.dMeta.textContent = ch.name + (p ? '  ·  ' + U.fmtDate(p.start) + ' ' + U.fmtClock(p.start) + ' – ' + U.fmtClock(p.end) : '');
        this.dTitle.textContent = p ? p.title : (l ? 'Geen programmagegevens' : 'Laden…');
        this.dDesc.textContent = p ? p.desc : '';
    },

    requestEpg: function () {
        var self = this;
        clearTimeout(this.epgT);
        this.epgT = setTimeout(function () {
            var r = self.list.range(), items = self.list.items;
            for (var i = r[0]; i <= r[1]; i++) {
                if (items[i]) EPG.request(items[i].stream_id, EPG.FULL, function () {
                    if (self.pi < 0) self.syncProg();
                    self.list.refresh();
                    self.updateDetail();
                });
            }
        }, 250);
    },

    stepProg: function (d) {
        var l = this.progs(this.list.current()), half = 30 * 60000, min = this.floor30(Date.now());
        if (!l || !l.length || this.pi < 0) {
            this.win = Math.max(min, this.win + d * half);
            this.ft = Math.max(this.win, Date.now());
        } else {
            var ni = this.pi + d;
            if (ni < 0 || ni >= l.length) {
                this.win = Math.max(min, this.win + d * half);
            } else {
                this.pi = ni;
                var p = l[ni], winEnd = this.win + this.WIN * 60000;
                if (p.start < this.win) this.win = Math.max(min, this.floor30(p.start));
                else if (p.start >= winEnd - half) this.win = this.floor30(p.start) - half;
                this.ft = Math.max(p.start, this.win) + 1000;
            }
        }
        this.draw();
    },

    onKey: function (k) {
        if (!this.items) return false;
        switch (k) {
            case 'up': case 'down':
                if (this.list.move(k)) { this.syncProg(); this.list.refresh(); this.updateDetail(); this.requestEpg(); }
                else if (k === 'up') this.navFocus(true);
                return true;
            case 'chup': case 'chdown':
                this.list.page(k === 'chup' ? -1 : 1); this.syncProg(); this.list.refresh(); this.updateDetail(); this.requestEpg();
                return true;
            case 'left': this.stepProg(-1); return true;
            case 'right': this.stepProg(1); return true;
            case 'ok': case 'play':
                var ch = this.list.current();
                if (ch) App.go('player', { mode: 'live', channel: ch, list: this.items });
                return true;
        }
        return false;
    }
};
