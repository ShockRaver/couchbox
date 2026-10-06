/* Volledig-scherm speler voor live TV, films, afleveringen en terugkijken (archief van een zender) */
Screens.player = {
    keepVideo: true,
    ASPECT: { letterbox: 'Passend', fill: 'Uitrekken', auto: 'Automatisch' },

    build: function () {
        var self = this;
        this.el = UI.screen('player', 'player');
        this.subEl = U.h('div', { class: 'subs' });
        this.spin = U.h('div', { class: 'spinner big' });
        this.msg = U.h('div', { class: 'p-msg' });
        this.pauseIc = U.h('div', { class: 'p-pause', html: Icons.get('pause') });
        this.numEl = U.h('div', { class: 'num-entry' });
        this.oLogo = U.h('div', { class: 'osd-logo-box' });
        this.oTitle = U.h('div', { class: 'osd-title' });
        this.oSub = U.h('div', { class: 'osd-sub' });
        this.oEpg = U.h('div', { class: 'osd-epg' });
        this.barFill = U.h('div', { class: 'fill' });
        this.barKnob = U.h('div', { class: 'knob' });
        this.tCur = U.h('span');
        this.tDur = U.h('span');
        this.btnRow = U.h('div', { class: 'osd-btns' });
        this.osd = U.h('div', { class: 'osd' }, [
            U.h('div', { class: 'osd-top' }, [this.oLogo, U.h('div', { class: 'osd-head' }, [this.oTitle, this.oSub]), U.h('div', { class: 'clock osd-clock' })]),
            this.oEpg,
            U.h('div', { class: 'osd-progress' }, [U.h('div', { class: 'osd-bar' }, [this.barFill, this.barKnob]), U.h('div', { class: 'osd-times' }, [this.tCur, this.tDur])]),
            this.btnRow,
            U.h('div', { class: 'osd-hint' })
        ]);
        this.hintEl = this.osd.querySelector('.osd-hint');
        this.listTitle = U.h('div', { class: 'p-list-title' });
        this.listItems = U.h('div', { class: 'p-list-items' });
        this.listBox = U.h('div', { class: 'p-list' }, [this.listTitle, this.listItems]);
        this.chList = new VList(this.listItems, { itemH: 92, render: function (c) { return self.renderListCh(c); } });
        this.nextBox = U.h('div', { class: 'p-next' });
        [this.subEl, this.spin, this.msg, this.pauseIc, this.numEl, this.osd, this.listBox, this.nextBox].forEach(function (e) { self.el.appendChild(e); });
        this.numBuf = '';
        this.bi = 0;
    },

    show: function (p) {
        var self = this;
        this.p = p;
        this.mode = p.mode;
        this.live = p.mode === 'live';
        this.el.classList.toggle('is-live', this.live);
        this.overlay = null;   // 'list' | 'next' | null
        this.osdMode = null;   // null | 'info' | 'menu'
        this.seekTarget = null;
        this.doneKey = null;
        this.bi = 0;
        this.listBox.classList.remove('show');
        this.nextBox.classList.remove('show');
        this.subEl.innerHTML = '';
        this.setMsg('');
        Player.setRect(null);
        this.attach();
        if (this.live) {
            this.list = p.list && p.list.length ? p.list.filter(function (c) { return c && c.stream_id != null; }) : [p.channel];
            this.idx = this.findIdx(p.channel);
            this.ch = null;
            this.prevCh = null;
            if (!p.list) {
                // Bijv. automatisch starten: zappen binnen de categorie van de laatste zender
                Api.liveStreams().then(function (all) {
                    if (self.p !== p) return;
                    var same = all.filter(function (s) { return String(s.category_id) === String(p.channel.category_id); });
                    self.list = same.length ? same : all;
                    self.idx = self.findIdx(self.ch || p.channel);
                }).catch(function () { /* zappen blijft beperkt */ });
            }
            this.tune(p.channel);
        } else if (this.mode === 'archive') {
            // Terugkijken: een programma uit het archief van de zender; telt niet mee voor "Verder kijken"
            this.ch = p.channel;
            this.prog = p.prog;
            this.item = { id: 'arc', name: p.prog.title, icon: p.channel.stream_icon };
            this.arcBase = 0;
            this.startVod(0);
        } else {
            this.item = p.item;
            this.episodes = p.episodes || null;
            if (this.mode === 'episode' && !this.episodes && p.series) {
                Api.seriesInfo(p.series.id).then(function (res) {
                    if (self.p === p) { self.episodes = App.parseSeries(res).flat; self.buildButtons(); }
                }).catch(function () { /* geen volgende aflevering */ });
            }
            this.startVod(p.startAt || 0);
            this.saveT = setInterval(function () { self.saveProgress(); }, 10000);
        }
        this.hintEl.innerHTML = this.live
            ? '▲▼ zappen · ◀▶ zenderlijst · <b>OK</b> menu · cijfers = zendernummer'
            : this.mode === 'archive' ? '<b>OK</b> pauze · ◀▶ minuut terug/verder · ▼ menu (audio, ondertitels)'
                : '<b>OK</b> pauze · ◀▶ spoelen · ▼ menu (audio, ondertitels)';
        this.buildButtons();
        this.showOsd('info');
        this.tickT = setInterval(function () { self.updateOsd(); }, 500);
    },

    hide: function () {
        if (!this.live) this.saveProgress();
        clearInterval(this.tickT); clearInterval(this.saveT); clearInterval(this.nextT);
        clearTimeout(this.osdT); clearTimeout(this.zapT); clearTimeout(this.seekT); clearTimeout(this.numT); clearTimeout(this.subT); clearTimeout(this.leT);
        if (this.seekTarget != null) { if (this.mode !== 'archive') Player.seek(this.seekTarget); this.seekTarget = null; }
        this.detach();
        this.hideOsd();
        this.numEl.classList.remove('show');
        this.el.classList.remove('paused', 'buffering');
    },

    attach: function () {
        var self = this;
        this.detach();
        this.offs = [
            Player.on('state', function (s) { self.onState(s); }),
            Player.on('buffering', function (b) { self.el.classList.toggle('buffering', !!b); }),
            Player.on('error', function (m) {
                self.setMsg(self.live ? 'Deze zender kan nu niet worden afgespeeld.\nProbeer een andere zender met ▲ / ▼.'
                    : self.mode === 'archive' ? 'Dit programma kan niet worden teruggekeken.\nMisschien bewaart je provider het niet (meer).'
                        : 'Deze video kan niet worden afgespeeld.\n(' + m + ')');
            }),
            Player.on('retry', function (n) { self.setMsg('Verbinding verbroken – opnieuw verbinden (' + n + ')…'); }),
            Player.on('ended', function () { self.onEnded(); }),
            Player.on('subtitle', function (t, d) { self.showSub(t, d); })
        ];
    },
    detach: function () { (this.offs || []).forEach(function (f) { f(); }); this.offs = []; },

    onState: function (s) {
        this.el.classList.toggle('paused', s === 'paused');
        this.el.classList.toggle('buffering', s === 'loading' || s === 'retry');
        if (s === 'playing') {
            this.setMsg('');
            if (this.osdMode) this.armOsd();
            // Terugkijken: onthouden welk archiefformaat bij deze provider werkt
            if (this.mode === 'archive' && this.arcUrls) {
                var u = Player.url(), hit = this.arcUrls.filter(function (x) { return x.url === u; })[0];
                if (hit) Store.setP('arcFmt', hit.fmt);
            }
        }
        if (s === 'paused') { if (!this.osdMode) this.showOsd('info'); else clearTimeout(this.osdT); }
    },

    setMsg: function (t) { this.msg.textContent = t || ''; },

    findIdx: function (ch) {
        if (!ch) return 0;
        var id = String(ch.stream_id);
        var i = this.list.findIndex(function (c) { return String(c.stream_id) === id; });
        return i < 0 ? 0 : i;
    },

    // ---- Live ----
    tune: function (ch) {
        var self = this;
        if (this.ch && String(this.ch.stream_id) !== String(ch.stream_id)) this.prevCh = this.ch;
        this.ch = ch;
        var url = Api.liveUrl(ch), st = Player.state();
        if (!(Player.url() === url && (st === 'playing' || st === 'loading' || st === 'paused' || st === 'retry'))) {
            Player.play(url, { live: true, meta: ch, uhd: /4k|uhd/i.test(ch.name) });
        }
        this.setMsg('');
        Store.setLastChannel(App.chMin(ch));
        EPG.request(ch.stream_id, 4, function () { if (!self.pendingCh) self.fillLive(); });
        this.fillLive();
        this.buildButtons();
    },

    zap: function (d) {
        var self = this, n = this.list.length;
        if (n < 2) return;
        this.idx = (this.idx + d + n) % n;
        var c = this.pendingCh = this.list[this.idx];
        this.fillLive(c);
        this.showOsd('info');
        EPG.request(c.stream_id, 4, function () { if (self.pendingCh === c) self.fillLive(c); });
        clearTimeout(this.zapT);
        this.zapT = setTimeout(function () { var x = self.pendingCh; self.pendingCh = null; if (x) self.tune(x); }, 450);
    },

    fillLive: function (c) {
        c = c || this.ch;
        if (!c) return;
        this.oLogo.innerHTML = '';
        this.oLogo.appendChild(U.img(c.stream_icon, 'osd-logo', c.name));
        this.oTitle.textContent = (c.num ? c.num + '   ' : '') + c.name;
        this.oSub.textContent = Store.isFav('live', c.stream_id) ? '★ Favoriet' : '';
        var nn = EPG.nowNext(c.stream_id), t;
        if (!nn) t = '<span class="muted">Programmagegevens laden…</span>';
        else if (!nn.cur && !nn.next) t = '<span class="muted">Geen programmagegevens</span>';
        else {
            t = nn.cur ? '<b>Nu</b> ' + U.fmtClock(nn.cur.start) + '–' + U.fmtClock(nn.cur.end) + '&nbsp;&nbsp;' + U.esc(nn.cur.title) : '';
            if (nn.next) t += (t ? '<br>' : '') + '<span class="muted"><b>Straks</b> ' + U.fmtClock(nn.next.start) + '&nbsp;&nbsp;' + U.esc(nn.next.title) + '</span>';
        }
        this.oEpg.innerHTML = t;
        this.liveProg = nn && nn.cur;
        this.updateOsd();
    },

    // ---- Films/afleveringen ----
    startVod: function (startAt) {
        var it = this.item;
        if (this.mode === 'archive') {
            // Archief-URL vanaf het gekozen punt; doorspoelen = opnieuw starten vanaf de nieuwe minuut (werkt bij elke provider)
            var pr = this.prog, urls = Api.archiveUrls(this.ch, pr, this.arcBase, (pr.end - pr.start - this.arcBase) / 60000);
            this.arcUrls = urls;
            Player.play(urls[0].url, { live: false, startAt: 0, meta: this.ch, retries: 0, alts: urls.slice(1).map(function (x) { return x.url; }) });
            this.fillVod();
            return;
        }
        var url = this.mode === 'movie' ? Api.movieUrl(it) : Api.episodeUrl(it);
        Player.play(url, { live: false, startAt: startAt || 0, meta: it, uhd: /4k|uhd/i.test(it.name || '') });
        if (this.mode === 'episode' && this.p.series) Follow.clear(this.p.series.id, it.id);
        this.fillVod();
    },

    fillVod: function () {
        var it = this.item;
        this.oLogo.innerHTML = '';
        if (this.mode === 'archive') {
            var pr = this.prog;
            this.oLogo.appendChild(U.img(this.ch.stream_icon, 'osd-logo', this.ch.name));
            this.oTitle.textContent = pr.title;
            this.oSub.textContent = this.ch.name + ' · ' + U.fmtDate(pr.start) + ' ' + U.fmtClock(pr.start) + ' – ' + U.fmtClock(pr.end) + ' · terugkijken';
            this.oEpg.textContent = pr.desc || '';
            return;
        }
        this.oLogo.appendChild(U.img((this.p.series && this.p.series.icon) || it.icon, 'osd-poster', it.name));
        if (this.mode === 'episode' && this.p.series) {
            this.oTitle.textContent = this.p.series.name;
            this.oSub.textContent = 'S' + it.season + ' E' + it.episode + ' · ' + it.name;
        } else {
            this.oTitle.textContent = it.name;
            this.oSub.textContent = '';
        }
        this.oEpg.innerHTML = '';
    },

    // Positie en duur; bij terugkijken telt de startminuut van de archief-URL mee
    vodDur: function () { return this.mode === 'archive' ? this.prog.end - this.prog.start : Player.duration(); },
    vodPos: function () { return this.mode === 'archive' ? this.arcBase + Player.time() : Player.time(); },
    applySeek: function (t) {
        if (this.mode !== 'archive') { Player.seek(t); return; }
        this.arcBase = Math.floor(t / 60000) * 60000;
        this.startVod(0);
    },

    saveProgress: function () {
        if (this.live || !this.item || this.mode === 'archive') return;
        var pos = this.seekTarget != null ? this.seekTarget : Player.time(), dur = Player.duration();
        if (!dur || pos < 5000) return;
        var key = this.mode + ':' + this.item.id, it = this.item;
        if (App.isFinished(pos, dur)) { this.markDone(); return; }
        Store.saveProgress({
            key: key, mode: this.mode, id: it.id, name: it.name, icon: it.icon, ext: it.ext, tmdb: it.tmdb || '',
            season: it.season, episode: it.episode, series: this.p.series || null, position: pos, duration: dur
        });
    },

    // Uitgekeken: als gezien markeren; bij series de volgende aflevering klaarzetten in "Verder kijken"
    markDone: function () {
        if (this.mode === 'archive') return;
        var it = this.item, key = this.mode + ':' + it.id;
        if (this.doneKey === key) return;
        this.doneKey = key;
        Store.markSeen(key);
        var next = this.nextEpisode();
        if (next && this.p.series) {
            Store.saveProgress({
                key: 'episode:' + next.id, mode: 'episode', id: next.id, name: next.name, icon: next.icon || it.icon, ext: next.ext,
                season: next.season, episode: next.episode, series: this.p.series, position: 0, duration: 0, upNext: true
            });
        } else Store.removeProgress(key);
    },

    // Wat "Mijn lijst" hier betekent: de film, of bij een aflevering de hele serie
    listTarget: function () {
        if (this.mode === 'movie' && this.item) return { type: 'movie', fav: { id: this.item.id, name: this.item.name, icon: this.item.icon, ext: this.item.ext } };
        if (this.mode === 'episode' && this.p.series) return { type: 'series', fav: { id: this.p.series.id, name: this.p.series.name, icon: this.p.series.icon } };
        return null;
    },

    nextEpisode: function () {
        if (this.mode !== 'episode' || !this.episodes) return null;
        var id = String(this.item.id);
        var i = this.episodes.findIndex(function (e) { return String(e.id) === id; });
        return i >= 0 ? this.episodes[i + 1] || null : null;
    },

    onEnded: function () {
        var self = this;
        if (this.live) {
            // Live-streams die "eindigen" zijn meestal een haperende verbinding: opnieuw starten
            setTimeout(function () { if (self.ch && App.screen() === self) Player.play(Api.liveUrl(self.ch), { live: true, meta: self.ch }); }, 1000);
            return;
        }
        this.markDone();
        var next = this.nextEpisode();
        if (next) this.askNext(next); else App.back();
    },

    askNext: function (next) {
        var self = this, left = 10;
        this.overlay = 'next';
        this.nextEp = next;
        var draw = function () {
            self.nextBox.innerHTML = '<div class="p-next-label">Volgende aflevering</div><div class="p-next-title">S' + next.season + ' E' + next.episode + ' · ' + U.esc(next.name) +
                '</div><div class="p-next-hint">Start over ' + left + ' s &nbsp;·&nbsp; <b>OK</b> nu starten &nbsp;·&nbsp; <b>Terug</b> stoppen</div>';
        };
        draw();
        this.nextBox.classList.add('show');
        clearInterval(this.nextT);
        this.nextT = setInterval(function () { left--; if (left <= 0) self.playEpisode(next); else draw(); }, 1000);
    },
    closeNext: function () { clearInterval(this.nextT); this.overlay = null; this.nextBox.classList.remove('show'); },

    playEpisode: function (ep) {
        this.closeNext();
        this.saveProgress();
        this.item = ep;
        var h = Store.progress('episode:' + ep.id);
        this.doneKey = null;
        this.startVod(h && h.position > 30000 && !App.isFinished(h.position, h.duration) ? h.position : 0);
        this.buildButtons();
        this.showOsd('info');
    },

    // ---- OSD ----
    showOsd: function (mode) {
        this.osdMode = mode || 'info';
        this.osd.classList.add('show');
        this.osd.classList.toggle('menu', this.osdMode === 'menu');
        this.el.classList.add('osd-on');
        this.drawButtons();
        this.updateOsd();
        this.armOsd();
    },
    armOsd: function () {
        var self = this;
        clearTimeout(this.osdT);
        if (Player.state() === 'paused') return;
        this.osdT = setTimeout(function () { self.hideOsd(); }, this.osdMode === 'menu' ? 8000 : 4500);
    },
    hideOsd: function () {
        clearTimeout(this.osdT);
        this.osdMode = null;
        this.osd.classList.remove('show', 'menu');
        this.el.classList.remove('osd-on');
    },

    updateOsd: function () {
        if (!this.osdMode) return;
        var frac = 0, a = '', b = '';
        if (this.live) {
            var p = this.liveProg;
            if (p) {
                var now = Date.now();
                if (now > p.end && !this.pendingCh) { this.liveProg = null; this.fillLive(); return; }
                frac = (now - p.start) / (p.end - p.start);
                a = U.fmtClock(p.start);
                b = U.fmtClock(p.end);
            }
        } else {
            var d = this.vodDur(), t = this.seekTarget != null ? this.seekTarget : this.vodPos();
            frac = d ? t / d : 0;
            a = U.fmtTime(t);
            b = d ? '-' + U.fmtTime(d - t) + '   /   ' + U.fmtTime(d) : '';
        }
        frac = U.clamp(frac, 0, 1);
        this.barFill.style.width = (frac * 100) + '%';
        this.barKnob.style.left = (frac * 100) + '%';
        this.tCur.textContent = a;
        this.tDur.textContent = b;
        this.osd.classList.toggle('seeking', this.seekTarget != null);
    },

    buildButtons: function () {
        var b = [];
        if (this.live) b.push({ id: 'list', label: 'Zenderlijst', icon: 'list' });
        b.push({ id: 'audio', label: 'Audio', icon: 'audio' }, { id: 'subs', label: 'Ondertitels', icon: 'subs' });
        if (this.live) b.push({ id: 'fav', label: 'Favoriet', icon: 'star', on: !!(this.ch && Store.isFav('live', this.ch.stream_id)) });
        b.push({ id: 'aspect', label: this.ASPECT[Store.settings().aspect] || 'Beeld', icon: 'aspect' });
        if (!this.live && this.listTarget()) {
            var inList = Store.isFav(this.listTarget().type, this.listTarget().fav.id);
            b.push({ id: 'mylist', label: inList ? 'In Mijn lijst' : 'Mijn lijst', icon: inList ? 'check' : 'plus', on: inList });
        }
        if (this.nextEpisode()) b.push({ id: 'next', label: 'Volgende aflevering', icon: 'next' });
        this.buttons = b;
        this.bi = U.clamp(this.bi, 0, b.length - 1);
        this.drawButtons();
    },
    drawButtons: function () {
        var self = this;
        this.btnRow.innerHTML = '';
        (this.buttons || []).forEach(function (b, i) {
            self.btnRow.appendChild(U.h('div', {
                class: 'osd-btn' + (i === self.bi && self.osdMode === 'menu' ? ' focus' : '') + (b.on ? ' on' : ''),
                html: Icons.get(b.icon) + '<span>' + U.esc(b.label) + '</span>'
            }));
        });
    },
    pressButton: function (id) {
        switch (id) {
            case 'list': this.hideOsd(); this.showList(); break;
            case 'audio': this.audioMenu(); break;
            case 'subs': this.subsMenu(); break;
            case 'fav': this.toggleFav(); break;
            case 'aspect': this.cycleAspect(); break;
            case 'next': var n = this.nextEpisode(); if (n) this.playEpisode(n); break;
            case 'mylist': var t = this.listTarget(); if (t) { App.toggleMyList(t.type, t.fav); this.buildButtons(); } break;
        }
    },

    audioMenu: function () {
        var tr = Player.tracks('AUDIO');
        if (!tr.length) { Toast.show('Geen audiosporen gevonden in deze stream'); return; }
        var cur = Player.currentTrack('AUDIO');
        Dialog.menu({ title: 'Audiospoor', items: tr.map(function (t) { return { id: t.index, label: t.label, checked: t.index === cur }; }) }, function (it) {
            if (it && Player.selectTrack('AUDIO', it.id)) Toast.show('Audio: ' + it.label);
        });
    },

    subsMenu: function () {
        var tr = Player.tracks('TEXT');
        if (!tr.length) { Toast.show('Deze stream bevat geen ondertitels'); return; }
        var on = Player.subtitlesActive(), cur = on ? Player.currentTrack('TEXT') : -1;
        var items = [{ id: -1, label: 'Uit', checked: !on }].concat(tr.map(function (t) { return { id: t.index, label: t.label, checked: on && t.index === cur }; }));
        Dialog.menu({ title: 'Ondertitels', items: items }, function (it) {
            if (!it) return;
            if (it.id === -1) { Player.subtitlesOff(); Toast.show('Ondertitels uit'); }
            else if (Player.selectTrack('TEXT', it.id)) Toast.show('Ondertitels: ' + it.label);
        });
    },

    cycleAspect: function () {
        var order = ['letterbox', 'fill', 'auto'], cur = Store.settings().aspect;
        var n = order[(order.indexOf(cur) + 1) % order.length];
        Store.setSetting('aspect', n);
        Player.applyAspect();
        Toast.show('Beeld: ' + this.ASPECT[n]);
        this.buildButtons();
    },

    toggleFav: function (c) {
        c = c || this.ch;
        if (!c) return;
        var added = Store.toggleFav('live', App.favFromCh(c));
        Toast.show(added ? '★ ' + c.name + ' toegevoegd aan favorieten' : c.name + ' verwijderd uit favorieten');
        this.buildButtons();
        this.fillLive();
    },

    showSub: function (t, d) {
        var self = this, clean = String(t || '').replace(/<[^>]*>/g, '').trim();
        clearTimeout(this.subT);
        this.subEl.innerHTML = clean ? '<span>' + U.esc(clean).replace(/\n/g, '<br>') + '</span>' : '';
        if (clean && d) this.subT = setTimeout(function () { self.subEl.innerHTML = ''; }, +d);
    },

    // ---- Zenderlijst-overlay ----
    showList: function () {
        this.hideOsd();
        this.overlay = 'list';
        this.listTitle.textContent = 'Zenders (' + this.list.length + ')';
        this.listBox.classList.add('show');
        this.chList.setActive(true);
        this.chList.setItems(this.list, this.idx);
        this.listEpg();
    },
    hideList: function () { this.overlay = null; this.listBox.classList.remove('show'); },
    listEpg: function () {
        var self = this;
        clearTimeout(this.leT);
        this.leT = setTimeout(function () {
            var r = self.chList.range(), items = self.chList.items;
            for (var i = r[0]; i <= r[1]; i++) if (items[i]) EPG.request(items[i].stream_id, 4, function () { self.chList.refresh(); });
        }, 250);
    },
    renderListCh: function (c) {
        var nn = EPG.nowNext(c.stream_id), playing = this.ch && String(this.ch.stream_id) === String(c.stream_id);
        var main = U.h('div', { class: 'ch-main' }, U.h('div', { class: 'ch-name', text: c.name }));
        if (nn && nn.cur) { main.appendChild(U.h('div', { class: 'ch-now', text: nn.cur.title })); main.appendChild(UI.pbar(UI.frac(nn.cur))); }
        return U.h('div', { class: 'ch-row' + (playing ? ' playing' : '') }, [
            U.h('div', { class: 'ch-num', text: c.num != null ? String(c.num) : '' }),
            U.img(c.stream_icon, 'ch-logo', c.name),
            main,
            Store.isFav('live', c.stream_id) ? U.h('div', { class: 'ch-fav', html: Icons.get('star') }) : null
        ]);
    },

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
            var i = self.list.findIndex(function (c) { return String(c.num) === num; });
            if (i >= 0) { self.idx = i; self.tune(self.list[i]); self.showOsd('info'); return; }
            Api.liveStreams().then(function (all) {
                var j = all.findIndex(function (c) { return String(c.num) === num; });
                if (j < 0) { Toast.show('Zender ' + num + ' niet gevonden'); return; }
                self.list = all;
                self.idx = j;
                self.tune(all[j]);
                self.showOsd('info');
            }).catch(function () { Toast.show('Zender ' + num + ' niet gevonden'); });
        }, 1300);
    },

    seekBy: function (dir, step) {
        var self = this, d = this.vodDur();
        if (!d) return;
        var now = Date.now();
        // Ingedrukt houden of snel herhalen = steeds grotere sprongen
        this.seekN = now - (this.seekLast || 0) < 800 ? (this.seekN || 0) + 1 : 0;
        this.seekLast = now;
        var mult = this.seekN > 8 ? 6 : this.seekN > 3 ? 3 : 1;
        var base = this.seekTarget != null ? this.seekTarget : this.vodPos();
        this.seekTarget = U.clamp(base + dir * step * mult, 0, Math.max(0, d - 5000));
        if (this.osdMode !== 'menu') this.showOsd('info'); else this.updateOsd();
        clearTimeout(this.seekT);
        this.seekT = setTimeout(function () { self.applySeek(self.seekTarget); self.seekTarget = null; self.updateOsd(); }, 800);
    },

    // ---- Toetsen ----
    onKey: function (k) {
        if (this.overlay === 'next') return this.keyNext(k);
        if (this.overlay === 'list') return this.keyList(k);
        if (this.live && Keys.isDigit(k)) { this.numInput(k); return true; }
        if (this.osdMode === 'menu' && this.keyMenu(k)) return true;
        return this.live ? this.keyLive(k) : this.keyVod(k);
    },

    keyMenu: function (k) {
        switch (k) {
            case 'left': case 'right':
                this.bi = U.clamp(this.bi + (k === 'left' ? -1 : 1), 0, this.buttons.length - 1);
                this.drawButtons();
                this.armOsd();
                return true;
            case 'ok': this.armOsd(); this.pressButton(this.buttons[this.bi].id); return true;
            case 'up': this.showOsd('info'); return true;
            case 'down': return true;
            case 'back': this.hideOsd(); return true;
        }
        return false;
    },

    keyLive: function (k) {
        switch (k) {
            case 'up': case 'chup': this.zap(1); return true;
            case 'down': case 'chdown': this.zap(-1); return true;
            case 'left': case 'right': case 'green': this.showList(); return true;
            case 'ok': this.showOsd('menu'); return true;
            case 'info': if (this.osdMode) this.hideOsd(); else this.showOsd('info'); return true;
            case 'prech':
                if (this.prevCh) { var pc = this.prevCh; this.idx = this.findIdx(pc); this.tune(pc); this.showOsd('info'); }
                return true;
            case 'red': this.toggleFav(); return true;
            case 'yellow': this.audioMenu(); return true;
            case 'blue': this.subsMenu(); return true;
            case 'stop': App.back(); return true;
        }
        return false;
    },

    keyVod: function (k) {
        switch (k) {
            case 'ok': case 'playpause': Player.toggle(); this.showOsd('info'); return true;
            case 'play': Player.resume(); this.showOsd('info'); return true;
            case 'pause': Player.pause(); this.showOsd('info'); return true;
            // Terugkijken: het archief start per minuut, dus daar springen we per minuut (⏪⏩ per 5 minuten)
            case 'left': this.seekBy(-1, this.mode === 'archive' ? 60000 : 10000); return true;
            case 'right': this.seekBy(1, this.mode === 'archive' ? 60000 : 10000); return true;
            case 'rw': this.seekBy(-1, this.mode === 'archive' ? 300000 : 60000); return true;
            case 'ff': this.seekBy(1, this.mode === 'archive' ? 300000 : 60000); return true;
            case 'up': case 'info': this.showOsd('info'); return true;
            case 'down': this.showOsd('menu'); return true;
            case 'yellow': this.audioMenu(); return true;
            case 'blue': this.subsMenu(); return true;
            case 'stop': App.back(); return true;
        }
        return false;
    },

    keyList: function (k) {
        switch (k) {
            case 'up': case 'down': this.chList.move(k); this.listEpg(); break;
            case 'chup': case 'chdown': this.chList.page(k === 'chup' ? -1 : 1); this.listEpg(); break;
            case 'ok':
                var c = this.chList.current();
                this.idx = this.chList.index;
                this.hideList();
                if (c) { this.tune(c); this.showOsd('info'); }
                break;
            case 'red': var x = this.chList.current(); if (x) { this.toggleFav(x); this.chList.refresh(); } break;
            case 'back': case 'left': case 'right': this.hideList(); break;
        }
        return true;
    },

    keyNext: function (k) {
        if (k === 'ok') this.playEpisode(this.nextEp);
        else if (k === 'back' || k === 'stop') { this.closeNext(); App.back(); }
        return true;
    }
};
