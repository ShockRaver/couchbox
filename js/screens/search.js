/* Zoeken in zenders, films, series én personen, in streaming-stijl: eigen toetsenbord links, resultaten rechts.
   Lokaal (direct, met tikfouten en TMDB-titels) via Find; online via TMDB voor acteurs/regisseurs
   en titels die nog niet aan TMDB gekoppeld zijn. Rijen staan op volgorde van de beste treffer. */
Screens.search = {
    RECENT_MAX: 4,

    build: function () {
        var self = this;
        this.el = UI.screen('search', 'nf nf-plain');
        this.nav = new TopNav('search');
        this.qText = U.h('span', { class: 'sk-text' });
        this.qEl = U.h('div', { class: 'sk-query', html: Icons.get('search') }, [this.qText, U.h('i', { class: 'sk-caret' })]);
        this.kb = new Keyboard(function (id) { self.press(id); });
        this.recentBox = U.h('div', { class: 'sk-recent' });
        this.el.appendChild(U.h('div', { class: 'sk' }, [this.qEl, this.kb.el, this.recentBox]));
        this.status = U.h('div', { class: 'search-msg' });
        var rowsBox = U.h('div', { class: 'nf-rows search-res' });
        this.el.appendChild(rowsBox);
        this.el.appendChild(this.status);
        this.el.appendChild(this.nav.el);
        this.rows = new RowStack(rowsBox);
        this.q = '';
        this.ri = 0;
        this.runSoon = U.debounce(function () { self.run(); }, 300);
        this.data = null;
        this.qToken = 0;
    },

    show: function () {
        this.setZone('keys');
        this.drawQuery();
        this.drawRecent();
        this.load();
    },

    resume: function () { this.rows.draw(); this.rows.rows.forEach(function (r) { r.list.refresh(); }); this.drawRecent(); },

    // Catalogus ophalen (zonder 18+ en dubbelen) en de zoekindex opbouwen
    load: function () {
        var self = this;
        // Verborgen 18+ of slot gewijzigd (bv. ontgrendeld): catalogus opnieuw filteren
        if (this.data && this.dataSig !== App.blockSig()) this.data = null;
        if (this.data && !Find.stale()) { this.run(); return; }
        if (this.loading) return;
        this.loading = true;
        if (!this.data) Find.reset();
        var safe = function (p) { return p.catch(function () { return []; }); };
        var get = this.data ? Promise.resolve(null) : Promise.all([safe(Api.liveStreams()), safe(Api.vodStreams(null)), safe(Api.series(null)),
            safe(Api.liveCategories()), safe(Api.vodCategories()), safe(Api.seriesCategories())]);
        this.setStatus(T('Catalogus laden voor zoeken… (kan even duren bij grote abonnementen)'));
        get.then(function (r) {
            if (r) {
                var a = [App.blockedIds('live', r[3]), App.blockedIds('movie', r[4]), App.blockedIds('series', r[5])], adult = App.hideIsAdult();
                var f = function (list, ad) {
                    return ad || adult ? list.filter(function (x) { return !(ad && App.inCats(x, ad)) && !(adult && String(x.is_adult) === '1'); }) : list;
                };
                self.data = { live: Lineup.visible(f(r[0], a[0])), movie: Genres.unique(f(r[1], a[1]), r[4]), series: Genres.unique(f(r[2], a[2]), r[5]) };
                self.dataSig = App.blockSig();
            }
            return Find.build(self.data, function (n, total) { self.setStatus(T('Zoekindex opbouwen… {pct}%', { pct: Math.round(n / Math.max(1, total) * 100) })); });
        }).then(function () {
            self.loading = false;
            self.setStatus('');
            self.run();
        }).catch(function (e) {
            self.loading = false;
            self.setStatus(T('Zoeken niet beschikbaar: {error}', { error: e.message }));
        });
    },

    setStatus: function (t) { this.status.textContent = t || ''; this.status.style.display = t ? '' : 'none'; },

    setZone: function (z) {
        this.zone = z;
        this.nav.setFocus(z === 'nav');
        this.rows.setActive(z === 'rows');
        this.kb.setActive(z === 'keys');
        this.drawRecent();
    },
    navFocus: function (b) { this.setZone(b ? 'nav' : 'keys'); },

    // ---- Toetsenbord en zoekregel ----
    drawQuery: function () {
        // Lange zoekopdracht: het einde blijft zichtbaar
        var q = this.q;
        this.qText.textContent = q ? (q.length > 24 ? '…' + q.slice(-23) : q) : T('Titel, zender, persoon');
        this.qText.classList.toggle('ph', !q);
    },
    press: function (id) {
        if (id === 'space') { if (this.q && this.q.slice(-1) !== ' ') this.q += ' '; }
        else if (id === 'del') this.q = this.q.slice(0, -1);
        else if (id === 'clear') this.q = '';
        else this.q += id;
        this.drawQuery();
        this.runSoon();
    },
    // Gewoon toetsenbord (browser of USB-toetsenbord aan de TV)
    onChar: function (ch) {
        if (ch === '\b') this.press('del');
        else if (ch === ' ') this.press('space');
        else this.press(ch.toLowerCase());
        if (this.zone === 'nav') this.setZone('keys');
    },

    // ---- Recente zoekopdrachten (per profiel) ----
    recent: function () { return Store.getP('recentSearch', []) || []; },
    remember: function () {
        var q = this.q.trim();
        if (q.length < 2) return;
        var list = this.recent().filter(function (x) { return x !== q; });
        list.unshift(q);
        Store.setP('recentSearch', list.slice(0, this.RECENT_MAX));
    },
    // Onder het toetsenbord: eerst "Bedoelde je …?" (als er een betere spelling is), dan recent gezocht
    picks: function () {
        var out = this.suggestion ? [{ q: this.suggestion, sug: true }] : [];
        return out.concat(this.recent().map(function (q) { return { q: q }; }));
    },
    drawRecent: function () {
        var self = this, list = this.picks(), head = false;
        this.recentBox.innerHTML = '';
        list.forEach(function (p, i) {
            if (p.sug) self.recentBox.appendChild(U.h('h4', { text: T('Bedoelde je') }));
            else if (!head) { head = true; self.recentBox.appendChild(U.h('h4', { text: T('Recent gezocht') })); }
            self.recentBox.appendChild(U.h('div', { class: 'sk-ritem' + (p.sug ? ' sug' : '') + (self.zone === 'recent' && i === self.ri ? ' focus' : ''), html: Icons.get(p.sug ? 'search' : 'restart') }, U.h('span', { text: p.q })));
        });
    },

    // Favorieten en recent bekeken iets hoger
    boost: function () {
        var fav = { live: {}, movie: {}, series: {} }, hist = { movie: {}, series: {} };
        ['live', 'movie', 'series'].forEach(function (t) { Store.favorites(t).forEach(function (f) { fav[t][String(f.id)] = 1; }); });
        Store.history().forEach(function (h) {
            if (h.mode === 'movie') hist.movie[String(h.id)] = 1;
            else if (h.series) hist.series[String(h.series.id)] = 1;
        });
        return function (type, it) {
            var id = String(type === 'live' || type === 'movie' ? it.stream_id : it.series_id);
            return (fav[type][id] ? 1.5 : 0) + (hist[type] && hist[type][id] ? 1 : 0);
        };
    },

    run: function () {
        var self = this, raw = this.q.trim(), q = U.norm(raw), my = ++this.qToken;
        clearTimeout(this.onlineT);
        this.res = null;
        if (this.suggestion) { this.suggestion = null; this.drawRecent(); }
        this.rows.clear();
        if (!Find.ready()) return;
        if (q.length < 2) {
            if (this.zone === 'rows') this.setZone('keys');
            this.setStatus(q.length ? T('Typ nog een letter…') : T('Zoek op titel, zender, acteur of regisseur.\nKies letters met de pijltjes en OK.'));
            return;
        }
        var r = Find.query(q, this.boost());
        this.res = { q: raw, live: r.live, movie: r.movie, series: r.series, people: [], withP: null };
        this.suggestion = Find.suggest(raw);
        this.drawRecent();
        this.render();
        // Online aanvullen (personen, nog niet gekoppelde titels) als de gebruiker even stopt met typen
        if (Tmdb.enabled() && q.length >= 3) this.onlineT = setTimeout(function () { self.online(raw, my); }, 400);
    },

    // TMDB: personen + titels die in je bibliotheek staan
    online: function (raw, my) {
        var self = this, fallback = false;
        var ask = function (q) {
            return Tmdb.api('search/multi', 'language=' + I18N.tmdb() + '&include_adult=false&query=' + encodeURIComponent(q)).then(function (d) { return (d && d.results) || []; });
        };
        ask(raw).then(function (res) {
            if (res.length) return res;
            // TMDB kent geen tikfouten ("keanu reves"): opnieuw met het langste woord, daarna streng filteren op de hele zoekopdracht
            var w = Find.words(raw).filter(function (t) { return t.length >= 3; }).sort(function (a, b) { return b.length - a.length; });
            if (w.length < 2) return res;
            fallback = true;
            return ask(w[0]);
        }).then(function (res) {
            if (my !== self.qToken) return;
            var DEPT = { Acting: T('Acteur'), Directing: T('Regie'), Writing: T('Schrijver'), Production: T('Producent') };
            // Personen: naam moet passen, en onbekende namen zonder foto overslaan
            var people = res.filter(function (x) { return x.media_type === 'person' && (x.profile_path || x.popularity >= 3); }).map(function (p) {
                return { id: p.id, name: p.name, img: p.profile_path || '', role: DEPT[p.known_for_department] || '', pop: p.popularity || 0, s: Find.score(raw, p.name) };
            }).filter(function (p) { return p.s > 0; }).sort(function (a, b) { return b.s - a.s || b.pop - a.pop; }).slice(0, 15);
            var titles = res.filter(function (x) {
                if (x.media_type !== 'movie' && x.media_type !== 'tv') return false;
                return !fallback || Find.score(raw, x.title || x.name) > 0 || Find.score(raw, x.original_title || x.original_name) > 0;
            }).map(function (x, i) { return { t: x.media_type === 'movie' ? 'm' : 't', id: x.id, rank: i }; });
            self.res.people = people;
            return Meta.inLibrary(titles).then(function (found) {
                if (my !== self.qToken) return;
                // Titels die de lokale zoektocht miste: score volgens de volgorde van TMDB
                found.forEach(function (f, i) {
                    var type = f.type === 'm' ? 'movie' : 'series', key = f.type === 'm' ? 'stream_id' : 'series_id', list = self.res[type];
                    if (list.some(function (x) { return String(x.item[key]) === String(f.item[key]); })) return;
                    list.push({ item: f.item, s: 7 - i * 0.3 });
                });
                ['movie', 'series'].forEach(function (t) { self.res[t].sort(function (a, b) { return b.s - a.s; }); });
                self.render();
                // Duidelijke treffer op een persoon: ook "Met <naam>" uit je bibliotheek
                var top = people[0];
                if (top && top.s >= 6) return self.withPerson(top, my);
            });
        }).catch(function (e) { console.warn('Online zoeken mislukt', e); });
    },

    withPerson: function (p, my) {
        var self = this;
        return Meta.person(p.id).then(function (pers) {
            if (!pers || my !== self.qToken) return;
            return Meta.inLibrary(pers.credits.slice().sort(function (a, b) { return b.pop - a.pop; })).then(function (list) {
                if (my !== self.qToken || !list.length) return;
                self.res.withP = { name: pers.name, items: list, s: p.s - 0.1 };
                self.render();
            });
        });
    },

    // Rijen opbouwen op volgorde van de beste treffer; positie van de cursor blijft behouden
    render: function () {
        var self = this, r = this.res, st = this.rows.state(), rows = [];
        if (!r) return;
        var top = function (list) { return list.length ? list[0].s : 0; }, items = function (list) { return list.map(function (x) { return x.item; }); };
        // Iets openen = zoekopdracht onthouden
        var open = function (fn) { return function () { self.remember(); fn.apply(null, arguments); }; };
        var small = function (type) { return function (it) { return UI.libCard(type, it, { small: true }); }; };
        if (r.live.length) rows.push({
            s: top(r.live), id: 'live', title: T('Zenders ({n})', { n: r.live.length }), items: items(r.live), itemW: 250, itemH: 214,
            render: function (c) { return UI.logoCard(c); },
            onSelect: open(function (c, i, list) { App.go('player', { mode: 'live', channel: c, list: list }); })
        });
        if (r.movie.length) rows.push({
            s: top(r.movie), id: 'movie', title: T('Films ({n})', { n: r.movie.length }), items: items(r.movie), itemW: 184, itemH: 320,
            render: small('m'), onSelect: open(function (m) { App.go('movie', { item: m }); })
        });
        if (r.series.length) rows.push({
            s: top(r.series), id: 'series', title: T('Series ({n})', { n: r.series.length }), items: items(r.series), itemW: 184, itemH: 320,
            render: small('t'), onSelect: open(function (x) { App.go('series', { item: x }); })
        });
        if (r.people.length) rows.push({
            s: r.people[0].s, id: 'people', title: T('Personen'), items: r.people, itemW: 190, itemH: 250,
            render: UI.personCard, onSelect: open(function (p) { App.go('person', { id: p.id, name: p.name }); })
        });
        if (r.withP) rows.push({
            s: r.withP.s, id: 'withp', title: T('Met {name} in je bibliotheek', { name: r.withP.name }), items: r.withP.items, itemW: 184, itemH: 320,
            render: function (x) { return UI.libCard(x.type, x.item, { small: true, sub: x.role }); },
            onSelect: open(function (x) { UI.openLib(x.type, x.item); })
        });
        rows.sort(function (a, b) { return b.s - a.s; });
        this.rows.clear();
        rows.forEach(function (row) { self.rows.add(row); });
        this.rows.restore(st);
        this.rows.setActive(this.zone === 'rows');
        this.setStatus(rows.length ? '' : T('Niets gevonden voor "{query}"', { query: r.q }) +
            (this.suggestion ? '\n' + T('Bedoelde je "{query}"? Kies het onder het toetsenbord.', { query: this.suggestion }) : '') +
            (Tmdb.enabled() ? '' : '\n' + T('(zoeken op acteurs werkt met een TMDB-sleutel)')));
    },

    onKey: function (k) {
        if (Keys.isDigit(k)) { this.press(k); return true; }
        if (this.zone === 'nav') {
            if (k === 'down') { this.setZone('keys'); return true; }
            return this.nav.key(k) || k === 'up';
        }
        if (this.zone === 'keys') return this.keysKey(k);
        if (this.zone === 'recent') return this.recentKey(k);
        switch (k) {
            case 'up': if (!this.rows.move('up')) this.setZone('nav'); return true;
            case 'left': if (!this.rows.move('left')) this.setZone('keys'); return true;
            case 'down': case 'right': this.rows.move(k); return true;
            case 'ok': this.rows.select(); return true;
            case 'back': this.setZone('keys'); return true;
        }
        return false;
    },

    keysKey: function (k) {
        // Het toetsenbord verlaten: rechts naar de resultaten, omhoog naar het menu, omlaag naar recent gezocht
        var r = this.kb.key(k);
        if (r === 'right') { if (this.rows.rows.length) this.setZone('rows'); return true; }
        if (r === 'up') { this.setZone('nav'); return true; }
        if (r === 'down') { if (this.picks().length) { this.ri = 0; this.setZone('recent'); } return true; }
        return r;
    },

    recentKey: function (k) {
        var list = this.picks().map(function (p) { return p.q; });
        switch (k) {
            case 'up': if (this.ri > 0) { this.ri--; this.drawRecent(); } else this.setZone('keys'); return true;
            case 'down': if (this.ri < list.length - 1) { this.ri++; this.drawRecent(); } return true;
            case 'right': if (this.rows.rows.length) this.setZone('rows'); return true;
            case 'left': return true;
            case 'ok': if (list[this.ri]) { this.q = list[this.ri]; this.drawQuery(); this.run(); } return true;
            case 'back': this.setZone('keys'); return true;
        }
        return false;
    }
};
