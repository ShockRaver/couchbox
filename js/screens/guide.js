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
        this.hdr = UI.header(T('TV-gids'));
        this.el.appendChild(this.hdr.el);
        // Balk met keuzes boven de gids
        this.chips = [
            { id: 'group', el: U.h('div', { class: 'g-chip' }) },
            { id: 'now', el: U.h('div', { class: 'g-chip', text: T('Nu') }) },
            { id: 'tonight', el: U.h('div', { class: 'g-chip', text: T('Vanavond') }) },
            { id: 'day', el: U.h('div', { class: 'g-chip', html: Icons.get('guide') + '<span>' + T('Andere dag') + '</span>' }) }
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
        this.list.setEmpty(T('Geen zenders'));
        UI.addNav(this, 'guide');
    },

    px: function () { return this.AREA_W / this.WIN; },
    floor30: function (t) { var d = new Date(t); d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0); return d.getTime(); },

    show: function (p) {
        var self = this;
        this.list.setItems([]);
        this.items = null;
        this.setZone('grid');
        Loader.show(T('TV-gids laden…'));
        this.loadGroups().then(function () {
            Loader.hide();
            // Vanuit Live TV: die categorie; anders de laatst gekozen groep (standaard favorieten, of alle zenders)
            if (p.items) return self.setup(p.items, p.index || 0, p.catId, p.catName);
            var saved = Store.getP('guideGroup', null);
            var g = self.groups.filter(function (x) { return x.id === saved; })[0] || self.groups[0];
            self.useGroup(g);
        }).catch(function (e) {
            Loader.hide();
            Dialog.notice(T('TV-gids laden mislukt'), e.message, function () { App.back(); });
        });
    },

    // Groepen uit de zenderindeling (Lineup): favorieten (als je die hebt), eigen lijsten, alle zenders en elke categorie
    loadGroups: function () {
        var self = this;
        return Lineup.load().then(function (L) {
            self.groups = L.groups.filter(function (g) { return g.n > 0 || g.id === 'all'; });
            // Zoals voorheen: favorieten bovenaan, daarna alle zenders
            var fav = self.groups.filter(function (g) { return g.id === 'fav'; });
            self.groups = fav.concat(self.groups.filter(function (g) { return g.id !== 'fav'; }));
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
        this.chips[0].el.innerHTML = Icons.get('list') + '<span>' + U.esc(groupName || T('Zenders')) + '</span><span class="g-cnt">' + items.length + '</span>';
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
            area.appendChild(U.h('div', { class: 'g-prog empty', style: { left: '0px', width: (this.AREA_W - 4) + 'px' }, text: l ? T('Geen programmagegevens') : T('Laden…') }));
        } else {
            l.forEach(function (p, j) {
                if (p.end <= ws || p.start >= we) return;
                var a = Math.max(p.start, ws), b = Math.min(p.end, we);
                var cls = 'g-prog' + (p.start <= now && p.end > now ? ' g-live' : '') + (focusRow && j === self.pi ? ' focus' : '');
                var rem = p.start > now && Remind.has(ch, p);
                area.appendChild(U.h('div', { class: cls, style: { left: ((a - ws) / 60000 * px) + 'px', width: Math.max(2, (b - a) / 60000 * px - 4) + 'px' } }, [
                    U.h('div', { class: 'g-t', html: (rem ? Icons.get('bell') : '') + U.esc(p.title) }),
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
        this.dTitle.textContent = p ? p.title : (l ? T('Geen programmagegevens') : T('Laden…'));
        this.dDesc.textContent = p ? p.desc : '';
        if (p && p.start > Date.now() && Remind.has(ch, p)) this.dMeta.textContent += '  ·  ' + T('herinnering staat aan');
    },

    // Naar een tijdstip springen (venster begint een half uur ervoor, nooit in het verleden)
    jump: function (t) {
        var min = this.floor30(Date.now());
        this.ft = Math.max(t, Date.now());
        this.win = Math.max(min, this.floor30(this.ft) - 30 * 60000);
        this.syncProg();
        this.draw();
        this.requestEpg();
    },
    tonight: function () { var d = new Date(); d.setHours(20, 0, 0, 0); if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1); return d.getTime(); },
    pickDay: function () {
        var self = this, items = [], cur = new Date(this.ft);
        for (var i = 0; i < 7; i++) {
            var d = new Date(); d.setDate(d.getDate() + i); d.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
            items.push({ id: i, label: i === 0 ? T('Vandaag') : i === 1 ? T('Morgen') : U.fmtDate(d.getTime()), t: d.getTime(), checked: d.toDateString() === cur.toDateString() });
        }
        Dialog.menu({ title: T('Andere dag'), text: T('Zelfde tijdstip ({time}), andere dag. Hoe ver vooruit hangt af van je provider.', { time: U.fmtClock(this.ft) }), items: items }, function (it) {
            if (it) self.jump(it.t);
        });
    },
    pickGroup: function () {
        var self = this;
        Dialog.menu({
            title: T('Welke zenders?'),
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
        var live = !p || (p.start <= now && p.end > now);
        if (p && p.start > now) items.push({ id: 'rem', label: Remind.has(ch, p) ? T('Herinnering verwijderen') : T('Herinner me ({time})', { time: U.fmtClock(p.start) }) });
        items.push({ id: 'watch', label: live ? T('Nu kijken') : T('Zender nu kijken') });
        items.push({ id: 'fav', label: fav ? T('Zender verwijderen uit favorieten') : T('Zender toevoegen aan favorieten') });
        if (Xmltv.source().mode !== 'api') {
            var lk = Xmltv.linked(ch.stream_id), auto = Xmltv.idFor(ch);
            items.push({ id: 'link', label: T('Gidsgegevens koppelen…'), hint: lk === '-' ? T('provider') : auto ? Xmltv.nameOf(auto) : T('niet gekoppeld') });
        }
        Dialog.menu({ title: p ? p.title : ch.name, text: ch.name + (p ? '  ·  ' + U.fmtDate(p.start) + ' ' + U.fmtClock(p.start) + ' – ' + U.fmtClock(p.end) : ''), items: items }, function (it) {
            if (!it) return;
            if (it.id === 'watch') App.go('player', { mode: 'live', channel: ch, list: self.items });
            else if (it.id === 'rem') {
                var on = Remind.toggle(ch, p);
                Toast.show(on ? T('Herinnering ingesteld voor {time}', { time: U.fmtClock(p.start) }) : T('Herinnering verwijderd'));
                self.list.refresh(); self.updateDetail();
            } else if (it.id === 'link') self.linkMenu(ch);
            else if (it.id === 'fav') {
                var added = Store.toggleFav('live', App.favFromCh(ch));
                Toast.show(added ? T('{name} toegevoegd aan favorieten', { name: ch.name }) : T('{name} verwijderd uit favorieten', { name: ch.name }));
                self.loadGroups();
            }
        });
    },

    // Zender handmatig aan een zender in de XMLTV-gids koppelen (als de naam of het epg-id niet automatisch klopt)
    linkMenu: function (ch) {
        var self = this, cur = Xmltv.linked(ch.stream_id);
        Dialog.text({
            title: T('Gidsgegevens voor {name}', { name: ch.name }), text: T('Zoek de zender in de XMLTV-gids op (een deel van) de naam.'),
            value: ch.name.replace(/^.*?\|\s*/, '').replace(/\b(uhd|fhd|hd|sd|4k)\b/gi, '').trim(), okLabel: T('Zoeken')
        }, function (q) {
            if (q == null) return;
            var hits = Xmltv.search(q);
            var items = [
                { id: '', label: T('Automatisch'), checked: !cur },
                { id: '-', label: T('Gids van de provider gebruiken'), checked: cur === '-' }
            ].concat(hits.map(function (h) { return { id: h.id, label: h.name, hint: h.id, checked: cur === h.id }; }));
            Dialog.menu({ title: T('Koppelen aan'), text: hits.length ? '' : T('Niets gevonden voor "{q}" in de XMLTV-gids.', { q: q }), items: items }, function (it) {
                if (!it) return;
                var download = Xmltv.link(ch.stream_id, it.id);
                var after = function () { self.list.refresh(); self.updateDetail(); self.requestEpg(); };
                if (download) {
                    Toast.show(T('Tv-gids wordt bijgewerkt voor deze zender…'), 4000);
                    Xmltv.refresh(true).then(after, function (e) { Toast.show(T('Tv-gids laden mislukt') + ': ' + e.message, 5000); });
                } else { Toast.show(T('Koppeling opgeslagen')); after(); }
            });
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
                if (ch) App.go('player', { mode: 'live', channel: ch, list: this.items });
                return true;
        }
        return false;
    }
};
