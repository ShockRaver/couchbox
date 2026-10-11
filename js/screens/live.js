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
            Dialog.notice(T('Zenders laden mislukt'), e.message, function () { App.back(); });
        });
    },

    setup: function (cats, streams, p) {
        this.src = [cats, streams];
        this.applyLineup(p.cat || Store.liveCat());
        this.setZone('chans');
    },

    // Groepen en zenders (opnieuw) opbouwen via Lineup (verborgen, eigen volgorde, eigen lijsten).
    // catId = welke groep tonen, focusId = welke zender selecteren
    applyLineup: function (catId, focusId) {
        var L = Lineup.build(this.src[0], this.src[1]);
        this.all = L.all;
        this.byId = L.byId;
        var list = L.groups;
        list.forEach(function (g) { g.count = g.n; });
        this.catList = list;
        // Opgeslagen id van voor de zenderindeling (zonder 'c:')
        if (catId && !/^(all$|fav$|l:|c:)/.test(catId)) catId = 'c:' + catId;
        var ci = list.findIndex(function (c) { return c.id === catId; });
        if (ci < 0) ci = Store.favorites('live').length ? 1 : 0;
        this.cats.setItems(list, ci, true);
        this.chans.setEmpty(T('Geen zenders in deze categorie'));
        this.loadCat(list[ci], focusId);
    },

    loadCat: function (cat, focusId) {
        var self = this, items;
        this.cat = cat;
        Store.setLiveCat(cat.id);
        items = cat.items();
        this.items = items;
        var m = Player.meta(), last = Store.lastChannel();
        var pid = focusId != null ? focusId : (Player.url() && m ? m.stream_id : (last ? last.stream_id : null));
        var idx = 0;
        if (pid != null) {
            var j = items.findIndex(function (s) { return String(s.stream_id) === String(pid); });
            if (j >= 0) idx = j;
        }
        this.chans.setEmpty(cat.locked ? T('Op slot. Druk op OK en voer de pincode in.') : T('Geen zenders in deze categorie'));
        this.chans.setItems(items, idx);
        this.hdr.sub.textContent = cat.locked ? cat.name : cat.name + ' · ' + (items.length === 1 ? T('{n} zender', { n: items.length }) : T('{n} zenders', { n: items.length }));
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
        // Favorieten of lijsten kunnen in de speler gewijzigd zijn: opnieuw opbouwen, focus op de spelende zender
        var cur = this.chans.current();
        this.applyLineup(this.cat.id, Player.url() && m ? m.stream_id : cur && cur.stream_id);
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
        var moving = this.moving === 'cat' && c === this.cats.current();
        return U.h('div', { class: 'cat' + (moving ? ' moving' : '') }, [
            moving ? U.h('span', { class: 'cat-ic', html: Icons.get('move') }) : c.id === 'fav' ? U.h('span', { class: 'cat-ic', html: Icons.get('star') })
                : c.kind === 'list' ? U.h('span', { class: 'cat-ic', html: Icons.get('list') }) : c.lock ? U.h('span', { class: 'cat-ic' + (c.locked ? '' : ' open'), html: Icons.get('lock') }) : null,
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
        var moving = this.moving === 'ch' && s === this.chans.current();
        return U.h('div', { class: 'ch-row' + (playing ? ' playing' : '') + (moving ? ' moving' : '') }, [
            U.h('div', { class: 'ch-num', text: s.num != null ? String(s.num) : '' }),
            U.img(s.stream_icon, 'ch-logo', s.name),
            main,
            Store.isFav('live', s.stream_id) ? U.h('div', { class: 'ch-fav', html: Icons.get('star') }) : null,
            playing ? U.h('div', { class: 'ch-live', html: Icons.get('play') }) : null,
            moving ? U.h('div', { class: 'ch-move', html: Icons.get('move') }) : null
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
        if (this.moving) return this.keyMove(k);
        if (Keys.isDigit(k)) { this.numInput(k); return true; }
        if (this.zone === 'cats') {
            switch (k) {
                case 'up': case 'down':
                    if (this.cats.move(k)) this.schedCat(); else if (k === 'up') this.navFocus(true);
                    return true;
                case 'chup': case 'chdown': this.cats.page(k === 'chup' ? -1 : 1); this.schedCat(); return true;
                case 'longok': case 'red': this.flushCat(); this.catMenu(); return true;
                case 'right': case 'ok':
                    this.flushCat();
                    if (this.cat.locked && k === 'ok') { this.unlockCat(); return true; }
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
        Player.play(Api.liveUrl(s), Api.liveOpts(s));
        Store.setLastChannel(App.chMin(s));
        this.chans.refresh();
    },

    contextMenu: function () {
        var self = this, s = this.chans.current();
        if (!s) return;
        var fav = Store.isFav('live', s.stream_id), c = this.cat;
        var items = [
            { id: 'play', label: T('Volledig scherm afspelen') },
            { id: 'fav', label: fav ? T('Verwijderen uit favorieten') : T('Toevoegen aan favorieten') },
            { id: 'lists', label: T('Zenderlijsten…'), hint: Lineup.lists().filter(function (l) { return Lineup.inList(l.id, s.stream_id); }).map(function (l) { return l.name; }).join(', ') }
        ];
        if ((c.kind === 'fav' || c.kind === 'list') && this.items.length > 1) items.push({ id: 'move', label: T('Verplaatsen') });
        if (c.kind === 'list') items.push({ id: 'unlist', label: T('Verwijderen uit {name}', { name: c.name }) });
        items.push({ id: 'hide', label: T('Zender verbergen') }, { id: 'guide', label: T('TV-gids voor deze categorie') });
        Dialog.menu({ title: s.name, items: items }, function (it) {
            if (!it) return;
            if (it.id === 'play') self.activate(true);
            else if (it.id === 'fav') self.toggleFav(s);
            else if (it.id === 'lists') self.listsMenu(s);
            else if (it.id === 'move') self.startMove('ch');
            else if (it.id === 'unlist') { Lineup.toggleInList(c.listId, s); self.applyLineup(c.id, self.neighbour()); }
            else if (it.id === 'hide') {
                var next = self.neighbour();
                Lineup.hideChannel(s.stream_id, true);
                Toast.show(T('{name} verborgen; terugzetten kan in Instellingen', { name: s.name }), 4000);
                self.applyLineup(c.id, next);
            }
            else if (it.id === 'guide') self.openGuide();
        });
    },
    // Zender naast de huidige (om na verbergen/verwijderen daarop te staan)
    neighbour: function () {
        var i = this.chans.index, x = this.items[i + 1] || this.items[i - 1];
        return x ? x.stream_id : null;
    },

    // Zender in eigen lijsten zetten of eruit halen; of een nieuwe lijst maken
    listsMenu: function (s) {
        var self = this, ls = Lineup.lists();
        var items = ls.map(function (l) { return { id: l.id, label: l.name, checked: Lineup.inList(l.id, s.stream_id) }; });
        items.push({ id: '_new', label: T('Nieuwe zenderlijst…') });
        Dialog.menu({ title: T('Zenderlijsten'), text: T('Kies een lijst om {name} toe te voegen of te verwijderen.', { name: s.name }), index: 0, items: items }, function (it) {
            if (!it) return;
            if (it.id === '_new') { self.newList(s); return; }
            var added = Lineup.toggleInList(it.id, s);
            Toast.show(added ? T('{name} toegevoegd aan {list}', { name: s.name, list: it.label }) : T('{name} verwijderd uit {list}', { name: s.name, list: it.label }));
            self.applyLineup(self.cat.id, s.stream_id);
        });
    },
    newList: function (s) {
        var self = this;
        Dialog.text({ title: T('Nieuwe zenderlijst'), text: T('Bijvoorbeeld Sport, Kids of Nieuws'), okLabel: T('Maken') }, function (v) {
            if (!v || !v.trim()) return;
            var l = Lineup.addList(v.trim());
            if (s) {
                Lineup.toggleInList(l.id, s);
                Toast.show(T('{name} toegevoegd aan {list}', { name: s.name, list: l.name }));
                self.applyLineup(self.cat.id, s.stream_id);
            } else self.applyLineup('l:' + l.id);
        });
    },

    // Opties voor een groep: verplaatsen, verbergen; eigen lijst: naam wijzigen, verwijderen
    catMenu: function () {
        var self = this, c = this.cats.current();
        if (!c) return;
        var items = [];
        if (c.kind === 'cat') items.push({ id: 'move', label: T('Verplaatsen') }, { id: 'hide', label: T('Groep verbergen') },
            App.isLocked('live', c.catId) ? { id: 'unlock', label: T('Slot eraf halen') } : { id: 'lock', label: T('Op slot zetten (pincode)') });
        if (c.kind === 'list') {
            items.push({ id: 'rename', label: T('Naam wijzigen') });
            if (Lineup.lists().length > 1) items.push({ id: 'move', label: T('Verplaatsen') });
            items.push({ id: 'del', label: T('Lijst verwijderen'), danger: true });
        }
        items.push({ id: 'new', label: T('Nieuwe zenderlijst…') });
        var az = Lineup.sortMode() === 'az';
        items.push({ id: 'sort', label: az ? T('Zenders sorteren op nummer') : T('Zenders sorteren van A tot Z'), hint: T('favorieten en eigen lijsten niet') });
        Dialog.menu({ title: c.name, items: items }, function (it) {
            if (!it) return;
            var here = self.cat.id === c.id;
            if (it.id === 'lock' || it.id === 'unlock') {
                UI.setCatLock('live', c.catId, it.id === 'lock', function () { self.applyLineup(self.cat.id); });
                return;
            }
            if (it.id === 'sort') {
                var cur = self.chans.current();
                Lineup.setSort(az ? 'num' : 'az');
                Toast.show(az ? T('Zenders op nummer') : T('Zenders van A tot Z'));
                self.applyLineup(self.cat.id, cur && cur.stream_id);
                return;
            }
            if (it.id === 'move') self.startMove('cat');
            else if (it.id === 'hide') {
                Lineup.hideCat(c.catId, true);
                Toast.show(T('{name} verborgen; terugzetten kan in Instellingen', { name: c.name }), 4000);
                self.applyLineup(here ? 'all' : self.cat.id);
            }
            else if (it.id === 'rename') Dialog.text({ title: T('Naam van de lijst'), value: c.name }, function (v) {
                if (v && v.trim()) { Lineup.renameList(c.listId, v.trim()); self.applyLineup(self.cat.id); }
            });
            else if (it.id === 'del') Dialog.ask(T('Lijst "{name}" verwijderen?', { name: c.name }), T('De zenders zelf blijven gewoon bestaan.'), function (yes) {
                if (yes) { Lineup.deleteList(c.listId); self.applyLineup(here ? 'fav' : self.cat.id); }
            }, T('Verwijderen'));
            else if (it.id === 'new') self.newList(null);
        });
    },

    // Groep op slot: pincode vragen, daarna alles ontgrendeld (tot de app naar de achtergrond gaat)
    unlockCat: function () {
        var self = this, id = this.cat.id;
        App.unlock(function (ok) { if (ok) { self.applyLineup(id); self.setZone('chans'); } });
    },

    // ---- Verplaatsen: ▲▼ schuift de groep of zender, OK of Terug = klaar ----
    startMove: function (what) {
        this.moving = what;   // 'cat' | 'ch'
        this.setZone(what === 'cat' ? 'cats' : 'chans');
        this.cats.refresh();
        this.chans.refresh();
        Toast.show(T('▲▼ verplaatsen · OK klaar'), 3000);
    },
    keyMove: function (k) {
        var L = this.moving === 'cat' ? this.cats : this.chans, i = L.index, items = L.items;
        if (k === 'up' || k === 'down') {
            var j = i + (k === 'up' ? -1 : 1);
            // Groepen alleen tussen hun eigen soort (categorieën onder elkaar, eigen lijsten onder elkaar)
            if (j < 0 || j >= items.length || (this.moving === 'cat' && items[j].kind !== items[i].kind)) return true;
            var x = items[i]; items[i] = items[j]; items[j] = x;
            L.setItems(items, j, true);
        } else if (k === 'ok' || k === 'back' || k === 'longok') this.endMove();
        return true;
    },
    endMove: function () {
        var what = this.moving, c;
        this.moving = null;
        if (what === 'cat') {
            c = this.cats.current();
            if (c.kind === 'list') Lineup.orderLists(this.cats.items.filter(function (x) { return x.kind === 'list'; }).map(function (x) { return x.id; }));
            else Lineup.setOrder(this.cats.items.filter(function (x) { return x.kind === 'cat'; }).map(function (x) { return x.catId; }));
            this.applyLineup(this.cat.id);
            this.cats.focus(this.catList.findIndex(function (x) { return x.id === c.id; }));
            this.setZone('cats');
        } else {
            var s = this.chans.current();
            Lineup.reorder(this.cat.id, this.chans.items.map(function (x) { return x.stream_id; }));
            this.applyLineup(this.cat.id, s && s.stream_id);
        }
        Toast.show(T('Volgorde bewaard'));
    },

    toggleFav: function (s) {
        var added = Store.toggleFav('live', App.favFromCh(s));
        Toast.show(added ? T('★ {name} toegevoegd aan favorieten', { name: s.name }) : T('{name} verwijderd uit favorieten', { name: s.name }));
        this.applyLineup(this.cat.id, this.cat.id === 'fav' && !added ? this.neighbour() : s.stream_id);
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
