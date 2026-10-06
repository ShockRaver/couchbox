/* TV-gids: tijdlijn per zender (EPG-raster).
   Bovenaan: groep kiezen (favorieten, alle zenders of een categorie) en springen in de tijd (nu, vanavond, andere dag).
   OK op een programma dat nog moet beginnen of OK ingedrukt houden: opties (kijken, herinnering, favoriet). */
Screens.guide = {
    longOk: true,
    WIN: 180,              // minuten zichtbaar in het venster
    CH_W: 470,             // breedte zenderkolom (px, incl. marge)
    AREA_W: 1370,          // breedte van het tijdvak (px)

    build: function () {
        var self = this;
        this.el = UI.screen('guide');
        this.hdr = UI.header('TV-gids');
        this.el.appendChild(this.hdr.el);
        // Balk met keuzes boven de gids
        this.chips = [
            { id: 'group', el: U.h('div', { class: 'g-chip' }) },
            { id: 'now', el: U.h('div', { class: 'g-chip', text: 'Nu' }) },
            { id: 'tonight', el: U.h('div', { class: 'g-chip', text: 'Vanavond' }) },
            { id: 'day', el: U.h('div', { class: 'g-chip', html: Icons.get('guide') + '<span>Andere dag</span>' }) }
        ];
        this.el.appendChild(U.h('div', { class: 'g-bar' }, this.chips.map(function (c) { return c.el; })));
        this.ci = 0;
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

    // ---- Terugkijken ----
    archDays: function (ch) { return ch && String(ch.tv_archive) === '1' ? Math.min(7, parseInt(ch.tv_archive_duration, 10) || 1) : 0; },
    // Vroegste tijdstip in de gids: zonder archief "nu", anders zo ver terug als de langste archiefduur in deze groep
    minTime: function () {
        var self = this, days = (this.items || []).reduce(function (m, c) { return Math.max(m, self.archDays(c)); }, 0);
        return days ? this.floor30(Date.now() - days * 86400e3) : this.floor30(Date.now());
    },
    // Is dit programma terug te kijken? (al begonnen, en volgens de EPG of binnen de archiefduur van de zender)
    canReplay: function (ch, p) {
        var days = this.archDays(ch), now = Date.now();
        if (!p || p.start >= now) return false;
        if (p.arc) return true;
        // Niet elke provider vult has_archive in: dan afgaan op het archief van de zender
        return days > 0 && p.start > now - days * 86400e3;
    },
    replay: function (ch, p) { App.go('player', { mode: 'archive', channel: ch, prog: p }); },
    floor30: function (t) { var d = new Date(t); d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0); return d.getTime(); },

    show: function (p) {
        var self = this;
        this.list.setItems([]);
        this.items = null;
        this.setZone('grid');
        Loader.show('TV-gids laden…');
        this.loadGroups().then(function () {
            Loader.hide();
            // Vanuit Live TV: die categorie; anders de laatst gekozen groep (standaard favorieten, of alle zenders)
            if (p.items) return self.setup(p.items, p.index || 0, p.catId === 'all' || p.catId === 'fav' ? p.catId : 'c:' + p.catId, p.catName);
            var saved = Store.getP('guideGroup', null);
            var g = self.groups.filter(function (x) { return x.id === saved; })[0] || self.groups[0];
            self.useGroup(g);
        }).catch(function (e) {
            Loader.hide();
            Dialog.alert('TV-gids laden mislukt', e.message, function () { App.back(); });
        });
    },

    // Groepen: favorieten (als je die hebt), alle zenders, en elke categorie (zonder 18+)
    loadGroups: function () {
        var self = this;
        return Promise.all([Api.liveCategories(), Api.liveStreams()]).then(function (r) {
            var adult = App.adultIds(r[0]);
            var all = adult ? r[1].filter(function (s) { return !App.inCats(s, adult); }) : r[1];
            var byId = {}, count = {};
            all.forEach(function (s) { byId[s.stream_id] = s; App.catIds(s).forEach(function (c) { count[c] = (count[c] || 0) + 1; }); });
            var favs = Store.favorites('live');
            self.groups = [];
            if (favs.length) self.groups.push({ id: 'fav', name: 'Favorieten', items: function () { return Store.favorites('live').map(function (f) { return byId[f.id] || App.chFromFav(f); }); }, n: favs.length });
            self.groups.push({ id: 'all', name: 'Alle zenders', items: function () { return all; }, n: all.length });
            r[0].forEach(function (c) {
                var id = String(c.category_id);
                if ((adult && adult[id]) || !count[id]) return;
                self.groups.push({ id: 'c:' + id, name: c.category_name, n: count[id], items: function () { return all.filter(function (s) { return App.catIds(s).indexOf(id) >= 0; }); } });
            });
        });
    },

    useGroup: function (g) {
        Store.setP('guideGroup', g.id);
        this.setup(g.items(), 0, g.id, g.name);
    },

    setup: function (items, index, groupId, groupName) {
        var self = this;
        this.items = items;
        this.groupId = groupId;
        this.win = this.floor30(Date.now());
        this.ft = Date.now();
        this.chips[0].el.innerHTML = Icons.get('list') + '<span>' + U.esc(groupName || 'Zenders') + '</span><span class="g-cnt">' + items.length + '</span>';
        this.list.setActive(this.zone === 'grid');
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
                var past = p.end <= now, replay = past && self.canReplay(ch, p);
                var cls = 'g-prog' + (p.start <= now && p.end > now ? ' g-live' : '') + (past ? ' g-past' : '') + (replay ? ' g-arc' : '') + (focusRow && j === self.pi ? ' focus' : '');
                var rem = p.start > now && Remind.has(ch, p);
                area.appendChild(U.h('div', { class: cls, style: { left: ((a - ws) / 60000 * px) + 'px', width: Math.max(2, (b - a) / 60000 * px - 4) + 'px' } }, [
                    U.h('div', { class: 'g-t', html: (rem ? Icons.get('bell') : replay ? Icons.get('restart') : '') + U.esc(p.title) }),
                    U.h('div', { class: 'g-tm', text: U.fmtClock(p.start) + ' – ' + U.fmtClock(p.end) })
                ]));
            });
        }
        return U.h('div', { class: 'g-row' }, [
            U.h('div', { class: 'g-ch' }, [
                U.h('span', { class: 'g-num', text: ch.num != null ? String(ch.num) : '' }),
                U.img(ch.stream_icon, 'g-logo', ch.name),
                U.h('span', { class: 'g-name', text: ch.name }),
                this.archDays(ch) ? U.h('span', { class: 'g-archic', html: Icons.get('restart') }) : null
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
        if (p && p.start > Date.now() && Remind.has(ch, p)) this.dMeta.textContent += '  ·  herinnering staat aan';
        else if (p && p.end <= Date.now()) this.dMeta.textContent += this.canReplay(ch, p) ? '  ·  terugkijken: druk op OK' : '  ·  niet terug te kijken';
    },

    // Naar een tijdstip springen (venster begint een half uur ervoor, nooit in het verleden)
    jump: function (t) {
        var min = this.minTime();
        this.ft = Math.max(t, min);
        this.win = Math.max(min, this.floor30(this.ft) - 30 * 60000);
        this.syncProg();
        this.draw();
        this.requestEpg();
    },
    tonight: function () { var d = new Date(); d.setHours(20, 0, 0, 0); if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1); return d.getTime(); },
    pickDay: function () {
        var self = this, items = [], cur = new Date(this.ft), back = Math.round((Date.now() - this.minTime()) / 86400e3);
        for (var i = -back; i < 7; i++) {
            var d = new Date(); d.setDate(d.getDate() + i); d.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
            var label = i === 0 ? 'Vandaag' : i === 1 ? 'Morgen' : i === -1 ? 'Gisteren' : U.fmtDate(d.getTime());
            items.push({ id: i, label: label, hint: i < 0 ? 'terugkijken' : '', t: d.getTime(), checked: d.toDateString() === cur.toDateString() });
        }
        Dialog.menu({ title: 'Andere dag', text: 'Zelfde tijdstip (' + U.fmtClock(this.ft) + '), andere dag. Hoe ver vooruit (en terug) hangt af van je provider.', items: items }, function (it) {
            if (it) self.jump(it.t);
        });
    },
    pickGroup: function () {
        var self = this;
        Dialog.menu({
            title: 'Welke zenders?',
            items: this.groups.map(function (g) { return { id: g.id, label: g.name, hint: String(g.n), checked: g.id === self.groupId, g: g }; })
        }, function (it) { if (it) { self.useGroup(it.g); self.setZone('grid'); } });
    },

    // ---- Zones: balk bovenaan of het raster ----
    setZone: function (z) {
        var self = this;
        this.zone = z;
        this.chips.forEach(function (c, i) { c.el.classList.toggle('focus', z === 'bar' && i === self.ci); });
        this.list.setActive(z === 'grid');
        if (this.items) this.list.refresh();
    },

    // Opties voor het programma onder de cursor
    progMenu: function () {
        var self = this, ch = this.list.current(), l = this.progs(ch), p = l && this.pi >= 0 ? l[this.pi] : null, now = Date.now();
        if (!ch) return;
        var fav = Store.isFav('live', ch.stream_id), items = [];
        var live = !p || (p.start <= now && p.end > now), replay = this.canReplay(ch, p);
        if (p && p.end <= now && replay) items.push({ id: 'replay', label: 'Terugkijken' });
        if (p && live && replay) items.push({ id: 'replay', label: 'Vanaf het begin kijken' });
        if (p && p.start > now) items.push({ id: 'rem', label: Remind.has(ch, p) ? 'Herinnering verwijderen' : 'Herinner me (' + U.fmtClock(p.start) + ')' });
        items.push({ id: 'watch', label: live ? 'Nu kijken' : 'Zender nu kijken' });
        items.push({ id: 'fav', label: fav ? 'Zender verwijderen uit favorieten' : 'Zender toevoegen aan favorieten' });
        Dialog.menu({ title: p ? p.title : ch.name, text: ch.name + (p ? '  ·  ' + U.fmtDate(p.start) + ' ' + U.fmtClock(p.start) + ' – ' + U.fmtClock(p.end) : ''), items: items }, function (it) {
            if (!it) return;
            if (it.id === 'watch') App.go('player', { mode: 'live', channel: ch, list: self.items });
            else if (it.id === 'replay') self.replay(ch, p);
            else if (it.id === 'rem') {
                var on = Remind.toggle(ch, p);
                Toast.show(on ? 'Herinnering ingesteld voor ' + U.fmtClock(p.start) : 'Herinnering verwijderd');
                self.list.refresh(); self.updateDetail();
            } else if (it.id === 'fav') {
                var added = Store.toggleFav('live', App.favFromCh(ch));
                Toast.show(added ? ch.name + ' toegevoegd aan favorieten' : ch.name + ' verwijderd uit favorieten');
                self.loadGroups();
            }
        });
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
        var l = this.progs(this.list.current()), half = 30 * 60000, min = this.minTime();
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
        if (this.zone === 'bar') {
            switch (k) {
                case 'left': case 'right': this.ci = U.clamp(this.ci + (k === 'left' ? -1 : 1), 0, this.chips.length - 1); this.setZone('bar'); return true;
                case 'up': this.navFocus(true); return true;
                case 'down': case 'back': this.setZone('grid'); return true;
                case 'ok': case 'longok':
                    var id = this.chips[this.ci].id;
                    if (id === 'group') this.pickGroup();
                    else if (id === 'now') { this.jump(Date.now()); this.setZone('grid'); }
                    else if (id === 'tonight') { this.jump(this.tonight()); this.setZone('grid'); }
                    else this.pickDay();
                    return true;
            }
            return false;
        }
        switch (k) {
            case 'up': case 'down':
                if (this.list.move(k)) { this.syncProg(); this.list.refresh(); this.updateDetail(); this.requestEpg(); }
                else if (k === 'up') this.setZone('bar');
                return true;
            case 'longok': this.progMenu(); return true;
            case 'chup': case 'chdown':
                this.list.page(k === 'chup' ? -1 : 1); this.syncProg(); this.list.refresh(); this.updateDetail(); this.requestEpg();
                return true;
            case 'left': this.stepProg(-1); return true;
            case 'right': this.stepProg(1); return true;
            case 'ok': case 'play':
                // Programma dat nog moet beginnen: opties (herinnering); anders meteen kijken
                var ch = this.list.current(), l = this.progs(ch), p = l && this.pi >= 0 ? l[this.pi] : null;
                if (k === 'ok' && p && p.start > Date.now()) { this.progMenu(); return true; }
                // Afgelopen programma: terugkijken als het kan
                if (k === 'ok' && p && p.end <= Date.now()) {
                    if (this.canReplay(ch, p)) this.replay(ch, p); else Toast.show('Dit programma is niet terug te kijken');
                    return true;
                }
                if (ch) App.go('player', { mode: 'live', channel: ch, list: this.items });
                return true;
        }
        return false;
    }
};
