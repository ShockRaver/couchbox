/* Live TV: categorieën, zenderlijst met EPG en een voorbeeldvenster */
Screens.live = {
    keepVideo: true,   // video blijft doorlopen in het voorbeeldvenster
    longOk: true,      // OK ingedrukt houden = optiemenu

    build: function () {
        var self = this;
        this.el = UI.screen('live', 'live');
        this.hdr = UI.header(T('Live TV'));
        this.el.appendChild(this.hdr.el);
        this.catBox = U.h('div', { class: 'col col-cats' });
        this.chBox = U.h('div', { class: 'col col-chans' });
        this.previewMsg = U.h('div', { class: 'preview-msg' });
        this.preview = U.h('div', { class: 'preview' }, this.previewMsg);
        this.info = U.h('div', { class: 'ch-info' });
        this.el.appendChild(U.h('div', { class: 'live-body' }, [this.catBox, this.chBox, U.h('div', { class: 'col-right' }, [this.preview, this.info])]));
        this.numEl = U.h('div', { class: 'num-entry' });
        this.el.appendChild(this.numEl);
        this.cats = new VList(this.catBox, { itemH: 72, pad: 10, render: function (c) { return self.renderCat(c); } });
        this.chans = new VList(this.chBox, { itemH: 100, pad: 10, render: function (c) { return self.renderCh(c); } });
        this.numBuf = '';
        UI.addNav(this, 'live');
    },

    show: function (p) {
        var self = this;
        this.catList = null;
        this.attach();
        this.setPreviewMsg('idle');
        this.cats.setItems([]);
        this.chans.setItems([]);
        this.chans.setEmpty('');
        this.info.innerHTML = '';
        Loader.show(T('Zenders laden…'));
        Promise.all([Api.liveCategories(), Api.liveStreams()]).then(function (r) {
            Loader.hide();
            self.setup(r[0], r[1], p || {});
        }).catch(function (e) {
            Loader.hide();
            Dialog.alert(T('Zenders laden mislukt'), e.message, function () { App.back(); });
        });
    },

    setup: function (cats, streams, p) {
        var self = this, adult = App.adultIds(cats), counts = {};
        this.all = adult ? streams.filter(function (s) { return !App.inCats(s, adult); }) : streams;
        this.byId = {};
        this.all.forEach(function (s) {
            self.byId[s.stream_id] = s;
            App.catIds(s).forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
        });
        var list = [{ id: 'all', name: T('Alle zenders'), count: this.all.length }, { id: 'fav', name: T('Favorieten'), count: Store.favorites('live').length }];
        cats.forEach(function (c) {
            var id = String(c.category_id);
            if (counts[id]) list.push({ id: id, name: c.category_name, count: counts[id] });
        });
        this.catList = list;
        var saved = p.cat || Store.liveCat();
        var ci = list.findIndex(function (c) { return c.id === saved; });
        if (ci < 0) ci = Store.favorites('live').length ? 1 : 0;
        this.cats.setItems(list, ci);
        this.chans.setEmpty(T('Geen zenders in deze categorie'));
        this.loadCat(list[ci]);
        this.setZone('chans');
    },

    loadCat: function (cat, focusId) {
        var self = this, items;
        this.cat = cat;
        Store.setLiveCat(cat.id);
        if (cat.id === 'all') items = this.all;
        else if (cat.id === 'fav') items = Store.favorites('live').map(function (f) { return self.byId[f.id] || App.chFromFav(f); });
        else items = this.all.filter(function (s) { return App.catIds(s).indexOf(cat.id) >= 0; });
        this.items = items;
        var m = Player.meta(), last = Store.lastChannel();
        var pid = focusId != null ? focusId : (Player.url() && m ? m.stream_id : (last ? last.stream_id : null));
        var idx = 0;
        if (pid != null) {
            var j = items.findIndex(function (s) { return String(s.stream_id) === String(pid); });
            if (j >= 0) idx = j;
        }
        this.chans.setItems(items, idx);
        this.hdr.sub.textContent = cat.name + ' · ' + (items.length === 1 ? T('{n} zender', { n: items.length }) : T('{n} zenders', { n: items.length }));
        this.updateInfo();
        this.requestEpg();
    },

    resume: function () {
        this.attach();
        if (!this.catList) return this.show({});
        var m = Player.meta();
        if (Player.url() && m) {
            Player.setRect(this.preview.getBoundingClientRect());
            this.setPreviewMsg(Player.state());
        } else this.setPreviewMsg('idle');
        this.catList[1].count = Store.favorites('live').length;
        this.cats.refresh();
        if (this.cat.id === 'fav') this.loadCat(this.cat);
        else {
            if (m) {
                var j = this.items.findIndex(function (s) { return String(s.stream_id) === String(m.stream_id); });
                if (j >= 0) this.chans.focus(j);
            }
            this.chans.refresh();
            this.updateInfo();
        }
    },

    hide: function () {
        this.detach();
        clearTimeout(this.catT); clearTimeout(this.infoT); clearTimeout(this.epgT); clearTimeout(this.numT);
        this.numEl.classList.remove('show');
    },

    attach: function () {
        var self = this;
        this.detach();
        this.offs = [Player.on('state', function (s) {
            self.setPreviewMsg(s === 'ended' ? 'idle' : s);
            if (s === 'playing' || s === 'idle') self.chans.refresh();
        })];
    },
    detach: function () { (this.offs || []).forEach(function (f) { f(); }); this.offs = []; },

    setPreviewMsg: function (st) {
        var t = { idle: T('Druk op OK voor een voorbeeld'), loading: T('Laden…'), retry: T('Opnieuw verbinden…'), error: T('Deze zender kan niet worden afgespeeld') }[st];
        this.preview.classList.toggle('playing', st === 'playing' || st === 'paused');
        this.previewMsg.innerHTML = (st === 'loading' || st === 'retry' ? '<div class="spinner"></div>' : Icons.get('tv')) + '<div>' + (t || '') + '</div>';
    },

    setZone: function (z) {
        this.zone = z;
        this.cats.setActive(z === 'cats');
        this.chans.setActive(z === 'chans');
    },

    renderCat: function (c) {
        return U.h('div', { class: 'cat' }, [
            c.id === 'fav' ? U.h('span', { class: 'cat-ic', html: Icons.get('star') }) : null,
            U.h('span', { class: 'cat-name', text: c.name }),
            U.h('span', { class: 'cnt', text: c.count != null ? String(c.count) : '' })
        ]);
    },

    renderCh: function (s) {
        var nn = EPG.nowNext(s.stream_id), m = Player.meta();
        var playing = !!(m && Player.url() && String(m.stream_id) === String(s.stream_id));
        var q = UI.quality(s.name);
        var main = U.h('div', { class: 'ch-main' }, U.h('div', { class: 'ch-name' }, [s.name, q.length ? UI.qualityTags(q, 'inline') : null]));
        if (nn && nn.cur) {
            main.appendChild(U.h('div', { class: 'ch-now', text: nn.cur.title }));
            main.appendChild(UI.pbar(UI.frac(nn.cur)));
        }
        return U.h('div', { class: 'ch-row' + (playing ? ' playing' : '') }, [
            U.h('div', { class: 'ch-num', text: s.num != null ? String(s.num) : '' }),
            U.img(s.stream_icon, 'ch-logo', s.name),
            main,
            Store.isFav('live', s.stream_id) ? U.h('div', { class: 'ch-fav', html: Icons.get('star') }) : null,
            playing ? U.h('div', { class: 'ch-live', html: Icons.get('play') }) : null
        ]);
    },

    updateInfo: function () {
        var self = this, s = this.chans.current();
        if (!s) { this.info.innerHTML = ''; return; }
        EPG.request(s.stream_id, 4, function () { if (self.chans.current() === s) self.renderInfo(s); });
        this.renderInfo(s);
    },

    renderInfo: function (s) {
        var el = this.info, nn = EPG.nowNext(s.stream_id);
        el.innerHTML = '';
        el.appendChild(U.h('div', { class: 'ci-head' }, [
            U.img(s.stream_icon, 'ci-logo', s.name),
            U.h('div', { class: 'ci-name' }, [
                U.h('div', { class: 'ci-title', text: s.name }),
                U.h('div', { class: 'ci-sub', text: (s.num ? T('Zender {num}', { num: s.num }) : '') + (Store.isFav('live', s.stream_id) ? '  ·  ★ ' + T('Favoriet') : '') })
            ])
        ]));
        if (!nn) el.appendChild(U.h('div', { class: 'ci-empty', text: T('Programmagegevens laden…') }));
        else if (!nn.cur && !nn.next) el.appendChild(U.h('div', { class: 'ci-empty', text: T('Geen programmagegevens beschikbaar') }));
        else {
            if (nn.cur) el.appendChild(U.h('div', { class: 'ci-prog' }, [
                U.h('div', { class: 'ci-when', html: '<span class="chip-now">' + T('NU') + '</span>' + U.fmtClock(nn.cur.start) + ' – ' + U.fmtClock(nn.cur.end) }),
                U.h('div', { class: 'ci-ptitle', text: nn.cur.title }),
                UI.pbar(UI.frac(nn.cur)),
                nn.cur.desc ? U.h('div', { class: 'ci-desc', text: nn.cur.desc }) : null
            ]));
            if (nn.next) el.appendChild(U.h('div', { class: 'ci-next' }, [
                U.h('span', { class: 'ci-when', text: T('Straks {time}', { time: U.fmtClock(nn.next.start) }) }),
                U.h('span', { class: 'ci-ntitle', text: nn.next.title })
            ]));
        }
        el.appendChild(U.h('div', { class: 'ci-hint', html: T('<b>OK</b> voorbeeld · nogmaals <b>OK</b> volledig scherm<br><b>OK</b> ingedrukt houden: favoriet &amp; opties') }));
    },

    // EPG ophalen voor de zenders die in beeld zijn
    requestEpg: function () {
        var self = this;
        clearTimeout(this.epgT);
        this.epgT = setTimeout(function () {
            var r = self.chans.range(), items = self.chans.items;
            for (var i = r[0]; i <= r[1]; i++) if (items[i]) EPG.request(items[i].stream_id, 4, function () { self.epgDirty(); });
        }, 300);
    },
    epgDirty: function () {
        var self = this;
        if (this.dirtyT) return;
        this.dirtyT = setTimeout(function () { self.dirtyT = null; self.chans.refresh(); }, 150);
    },

    focusChanged: function () {
        var self = this;
        clearTimeout(this.infoT);
        this.infoT = setTimeout(function () { self.updateInfo(); }, 150);
        this.requestEpg();
    },

    schedCat: function () {
        var self = this;
        clearTimeout(this.catT);
        this.catT = setTimeout(function () { self.flushCat(); }, 300);
    },
    flushCat: function () {
        clearTimeout(this.catT);
        var c = this.cats.current();
        if (c && c !== this.cat) this.loadCat(c);
    },

    onKey: function (k) {
        if (!this.catList) return false;
        if (Keys.isDigit(k)) { this.numInput(k); return true; }
        if (this.zone === 'cats') {
            switch (k) {
                case 'up': case 'down':
                    if (this.cats.move(k)) this.schedCat(); else if (k === 'up') this.navFocus(true);
                    return true;
                case 'chup': case 'chdown': this.cats.page(k === 'chup' ? -1 : 1); this.schedCat(); return true;
                case 'right': case 'ok': case 'longok':
                    this.flushCat();
                    if (this.items.length) this.setZone('chans');
                    return true;
            }
            return false;
        }
        switch (k) {
            case 'up': case 'down':
                if (this.chans.move(k)) this.focusChanged(); else if (k === 'up') this.navFocus(true);
                return true;
            case 'chup': case 'chdown': this.chans.page(k === 'chup' ? -1 : 1); this.focusChanged(); return true;
            case 'left': this.setZone('cats'); return true;
            case 'right': return true;
            case 'ok': this.activate(false); return true;
            case 'play': case 'playpause': this.activate(true); return true;
            case 'longok': case 'red': this.contextMenu(); return true;
            case 'green': case 'guide': this.openGuide(); return true;
            case 'stop': Player.stop(); this.chans.refresh(); return true;
        }
        return false;
    },

    activate: function (full) {
        var s = this.chans.current();
        if (!s) return;
        var m = Player.meta();
        var playingThis = Player.url() && m && String(m.stream_id) === String(s.stream_id) && Player.state() !== 'error';
        if (playingThis || full) App.go('player', { mode: 'live', channel: s, list: this.items });
        else this.previewPlay(s);
    },

    previewPlay: function (s) {
        Player.setRect(this.preview.getBoundingClientRect());
        Player.play(Api.liveUrl(s), { live: true, meta: s, uhd: /4k|uhd/i.test(s.name) });
        Store.setLastChannel(App.chMin(s));
        this.chans.refresh();
    },

    contextMenu: function () {
        var self = this, s = this.chans.current();
        if (!s) return;
        var fav = Store.isFav('live', s.stream_id);
        Dialog.menu({
            title: s.name,
            items: [
                { id: 'play', label: T('Volledig scherm afspelen') },
                { id: 'fav', label: fav ? T('Verwijderen uit favorieten') : T('Toevoegen aan favorieten') },
                { id: 'guide', label: T('TV-gids voor deze categorie') }
            ]
        }, function (it) {
            if (!it) return;
            if (it.id === 'play') self.activate(true);
            else if (it.id === 'fav') self.toggleFav(s);
            else if (it.id === 'guide') self.openGuide();
        });
    },

    toggleFav: function (s) {
        var added = Store.toggleFav('live', App.favFromCh(s));
        Toast.show(added ? T('★ {name} toegevoegd aan favorieten', { name: s.name }) : T('{name} verwijderd uit favorieten', { name: s.name }));
        this.catList[1].count = Store.favorites('live').length;
        this.cats.refresh();
        if (this.cat.id === 'fav') this.loadCat(this.cat); else { this.chans.refresh(); this.updateInfo(); }
    },

    openGuide: function () {
        App.go('guide', { items: this.items, index: this.chans.index, catId: this.cat.id, catName: this.cat.name });
    },

    // Zendernummer intypen met de cijfertoetsen
    numInput: function (k) {
        var self = this;
        this.numBuf = (this.numBuf + k).slice(-4);
        this.numEl.textContent = this.numBuf;
        this.numEl.classList.add('show');
        clearTimeout(this.numT);
        this.numT = setTimeout(function () {
            var num = self.numBuf;
            self.numBuf = '';
            self.numEl.classList.remove('show');
            var ch = self.all.filter(function (c) { return String(c.num) === num; })[0];
            if (!ch) { Toast.show(T('Zender {num} niet gevonden', { num: num })); return; }
            var j = self.items.indexOf(ch);
            if (j < 0) { self.cats.focus(0); self.loadCat(self.catList[0], ch.stream_id); }
            else { self.chans.focus(j); self.updateInfo(); self.requestEpg(); }
            self.setZone('chans');
            self.previewPlay(ch);
        }, 1300);
    }
};
