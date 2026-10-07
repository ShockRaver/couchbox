/* Instellingen (optioneel beveiligd met pincode) */
Screens.settings = {
    // Labels blijven hier Nederlands (de taal is bij het laden nog niet bekend); T() pas bij het tonen
    OPTS: {
        lang: [['en', 'English'], ['nl', 'Nederlands']],
        startup: [['none', 'Startscherm'], ['live', 'Laatste zender afspelen'], ['ask', 'Vragen: verder kijken?']],
        liveFormat: [['m3u8', 'HLS (.m3u8)'], ['ts', 'MPEG-TS (.ts)']],
        audioLang: [['auto', 'Automatisch'], ['nl', 'Nederlands'], ['en', 'Engels']],
        subLang: [['off', 'Uit'], ['nl', 'Nederlands'], ['en', 'Engels']],
        aspect: [['letterbox', 'Passend (zwarte balken)'], ['fill', 'Uitrekken tot volledig scherm'], ['auto', 'Automatisch']],
        hideAdult: [[false, 'Uit'], [true, 'Aan']]
    },

    build: function () {
        var self = this;
        this.el = UI.screen('settings');
        this.hdr = UI.header(T('Instellingen'));
        this.el.appendChild(this.hdr.el);
        var box = U.h('div', { class: 'settings-body' });
        this.el.appendChild(box);
        this.list = new VList(box, { itemH: 96, pad: 8, render: function (r) { return self.renderRow(r); } });
        this.list.setActive(true);
        UI.addNav(this, 'settings');
    },

    show: function () { this.render(0); this.startTicker(); },
    resume: function () { this.render(this.list.index); this.startTicker(); },

    rows: function () {
        var s = Store.settings(), p = Store.activeProfile(), a = Api.account(), ui = a && a.user_info;
        return [
            { id: 'lang', label: T('Taal') },
            { id: 'profile', label: T('Profiel'), value: p ? p.name : '–', action: true },
            { id: 'startup', label: T('Bij opstarten') },
            { id: 'liveFormat', label: T('Live-streamformaat') },
            { id: 'audioLang', label: T('Voorkeur audiotaal') },
            { id: 'subLang', label: T('Voorkeur ondertitels') },
            { id: 'aspect', label: T('Beeldweergave') },
            { id: 'hideAdult', label: T('Verberg 18+ categorieën') },
            { id: 'genreLangs', label: T('Talen in genres (films & series)'), value: this.langsLabel(), action: true },
            { id: 'tmdb', label: T('TMDB-gegevens (genres, posters, info)'), value: Tmdb.status(), action: true },
            { id: 'pin', label: T('Pincode voor instellingen'), value: s.pin ? T('Aan') : T('Uit'), action: true },
            { id: 'account', label: T('Account'), value: ui ? (ui.status || '') + ' · ' + App.expiryText() : T('Niet verbonden'), action: true },
            { id: 'refresh', label: T('Zenders, films en gids vernieuwen'), value: '', action: true },
            { id: 'history', label: T('Kijkgeschiedenis wissen'), value: '', action: true },
            { id: 'about', label: T('Over deze app'), value: T('versie {version}', { version: App.VERSION }) + (BUILD.date ? '  ·  ' + BUILD.date : ''), action: true }
        ];
    },

    render: function (idx) {
        this.list.setItems(this.rows(), idx);
        this.hdr.sub.textContent = T('◀ ▶ waarde wijzigen · OK kiezen');
    },

    valueLabel: function (id) {
        var v = Store.settings()[id], o = this.OPTS[id];
        var hit = o.filter(function (x) { return x[0] === v; })[0];
        if (!hit) return String(v);
        // Taalnamen altijd in hun eigen taal tonen
        return id === 'lang' ? hit[1] : T(hit[1]);
    },

    renderRow: function (r) {
        var opt = !!this.OPTS[r.id];
        return U.h('div', { class: 'set-row' }, [
            U.h('div', { class: 'set-label', text: r.label }),
            U.h('div', { class: 'set-val' }, [
                opt ? U.h('span', { class: 'arr', text: '◀' }) : null,
                U.h('span', { text: opt ? this.valueLabel(r.id) : (r.value || '') }),
                opt ? U.h('span', { class: 'arr', text: '▶' }) : (r.action ? U.h('span', { class: 'arr', text: '›' }) : null)
            ])
        ]);
    },

    cycle: function (id, d) {
        var o = this.OPTS[id], v = Store.settings()[id];
        var i = o.findIndex(function (x) { return x[0] === v; });
        var n = o[(i + d + o.length) % o.length][0];
        Store.setSetting(id, n);
        // Andere taal: app herstarten, zodat alle schermen in de nieuwe taal worden opgebouwd
        if (id === 'lang') {
            Loader.show(T('Taal wijzigen…'));
            setTimeout(function () { location.reload(); }, 300);
            return;
        }
        if (id === 'aspect') Player.applyAspect();
        this.list.refreshItem(this.list.index);
    },

    onKey: function (k) {
        var r = this.list.current();
        switch (k) {
            case 'up': case 'down': if (!this.list.move(k) && k === 'up') this.navFocus(true); return true;
            case 'left': case 'right': if (this.OPTS[r.id]) this.cycle(r.id, k === 'left' ? -1 : 1); return true;
            case 'ok':
                if (this.OPTS[r.id]) this.cycle(r.id, 1);
                else this.action(r.id);
                return true;
        }
        return false;
    },

    action: function (id) {
        var self = this;
        switch (id) {
            case 'profile': App.go('profiles', {}); break;
            case 'pin': this.pinMenu(); break;
            case 'account': this.accountInfo(); break;
            case 'refresh': App.refreshCatalog(); break;
            case 'genreLangs': this.langMenu(); break;
            case 'tmdb': this.tmdbMenu(); break;
            case 'history':
                Dialog.confirm(T('Kijkgeschiedenis wissen?'), T('Verder kijken en de "bekeken"-vinkjes van dit profiel worden gewist.'), function (yes) {
                    if (yes) { Store.clearHistory(); Toast.show(T('Kijkgeschiedenis gewist')); }
                }, T('Wissen'));
                break;
            case 'about':
                Dialog.alert('Kijkdoos ' + App.VERSION, (BUILD.date ? T('Geïnstalleerd op {date} (commit {commit})', { date: BUILD.date, commit: BUILD.commit }) + '\n\n' : '') + T('Tizen-webapp voor Samsung TV met Xtream Codes API.\nAfspelen via Samsung AVPlay (HLS, MPEG-TS, MP4, MKV).\n\nJe gegevens worden alleen lokaal op deze TV opgeslagen.\n\nFilm- en seriegegevens: The Movie Database (TMDB). Deze app gebruikt de TMDB API, maar wordt niet door TMDB onderschreven of gecertificeerd.'));
                break;
        }
    },

    tmdbMenu: function () {
        var self = this;
        // Nog geen sleutel: meteen laten invoeren
        if (!Tmdb.enabled()) { this.tmdbKeyEntry(); return; }
        var own = (Store.settings().tmdbKey || '').trim();
        var items = Tmdb.running() ? [{ id: 'stop', label: T('Pauzeren') }] : [{ id: 'start', label: T('Nu bijwerken') }];
        items.push({ id: 'key', label: own ? T('TMDB-sleutel wijzigen') : T('Eigen TMDB-sleutel invoeren') });
        if (own) items.push({ id: 'delkey', label: T('Sleutel van deze TV verwijderen'), danger: true });
        items.push({ id: 'clear', label: T('Alles opnieuw opzoeken'), danger: true });
        Dialog.menu({
            title: T('TMDB-gegevens'),
            text: Tmdb.status() + '\n' +
                (Meta.persistent() ? T('{n} titels met posters/info opgeslagen', { n: I18N.num(Meta.count()) }) : T('{n} titels met posters/info opgeslagen (alleen tijdelijk: opslag niet beschikbaar)', { n: I18N.num(Meta.count()) })) +
                '\n\n' + T('Kijkdoos zoekt op de achtergrond per film en serie genre, rating, jaar, speelduur en poster op bij TMDB. Cast en beschrijving worden opgehaald zodra je een titel opent.'),
            items: items
        }, function (it) {
            if (!it) return;
            if (it.id === 'key') { self.tmdbKeyEntry(); return; }
            if (it.id === 'delkey') {
                Store.setSetting('tmdbKey', '');
                Tmdb.stop(); Reco.reset(); Genres.reset(); Find.reset();
                if (Tmdb.enabled()) Tmdb.start();
                Toast.show(Tmdb.enabled() ? T('Sleutel verwijderd; de ingebouwde sleutel wordt gebruikt') : T('TMDB-sleutel verwijderd'));
                self.render(self.list.index);
                return;
            }
            if (it.id === 'start') Tmdb.start();
            else if (it.id === 'stop') Tmdb.stop();
            else if (it.id === 'clear') { Tmdb.clear(); Genres.reset(); Tmdb.start(); }
            Genres.reset();
            Toast.show('TMDB: ' + Tmdb.status());
            self.render(self.list.index);
        });
    },

    // TMDB-sleutel invoeren met het toetsenbord op het scherm; eerst bij TMDB controleren, dan pas opslaan
    tmdbKeyEntry: function () {
        var self = this;
        Dialog.text({
            title: T('TMDB-sleutel'),
            text: T('Voor posters, genres, zoeken op acteurs en aanbevelingen. Maak gratis een account op themoviedb.org, ga naar Instellingen → API en typ de "API Key" (32 tekens) hier over. Je hoeft dit maar één keer te doen.'),
            value: Store.settings().tmdbKey || '', placeholder: T('32 tekens, bv. 1a2b3c…'), okLabel: T('Controleren en opslaan')
        }, function (v) {
            if (v == null) return;
            v = v.replace(/\s+/g, '').toLowerCase();
            if (!v) return;
            if (!/^[0-9a-f]{32}$/.test(v)) {
                Dialog.alert(T('Dit lijkt geen TMDB-sleutel'), T('Een TMDB-sleutel ("API Key", niet de lange "Read Access Token") bestaat uit 32 tekens: cijfers en de letters a t/m f. Je typte {n} tekens.', { n: v.length }));
                return;
            }
            var old = Store.settings().tmdbKey || '';
            Store.setSetting('tmdbKey', v);
            Loader.show(T('Sleutel controleren bij TMDB…'));
            Tmdb.api('configuration').then(function (d) {
                Loader.hide();
                if (!d) throw new Error(T('Geen antwoord van TMDB'));
                Tmdb.stop(); Reco.reset(); Genres.reset(); Find.reset();
                Tmdb.start();
                Toast.show(T('TMDB-sleutel werkt en is opgeslagen'));
                self.render(self.list.index);
            }).catch(function (e) {
                Loader.hide();
                Store.setSetting('tmdbKey', old);
                Dialog.alert(T('Sleutel werkt niet'), (e && e.message) || T('TMDB weigert deze sleutel.'));
            });
        });
    },

    // Instellingenscherm elke paar seconden bijwerken zodat de TMDB-voortgang zichtbaar is
    startTicker: function () {
        var self = this;
        clearInterval(this.tick);
        this.tick = setInterval(function () {
            var i = self.list.items.findIndex(function (r) { return r.id === 'tmdb'; });
            if (i >= 0) { self.list.items[i].value = Tmdb.status(); self.list.refreshItem(i); }
        }, 3000);
    },
    hide: function () { clearInterval(this.tick); },

    langsLabel: function () {
        var s = Store.settings().genreLangs;
        if (!Array.isArray(s)) return T('Automatisch (NL, BE, MULTI, EN)');
        return s.length ? s.join(', ') : T('Alle talen');
    },

    // Meerkeuze: talen (voorvoegsels van categorieën) die meetellen in de genres; OK zet een taal aan/uit
    langMenu: function () {
        var self = this;
        Loader.show(T('Talen ophalen…'));
        Promise.all([Api.vodCategories(), Api.seriesCategories()]).then(function (r) {
            Loader.hide();
            var all = r[0].concat(r[1]), langs = Genres.langsIn(all);
            var chosen = (Genres.activeLangs(all) || langs).slice();
            var open = function (index) {
                var items = langs.map(function (l) { return { id: l, label: Genres.langName(l) + ' (' + l + ')', checked: chosen.indexOf(l) >= 0 }; });
                items.push({ id: '_all', label: T('Alle talen') }, { id: '_auto', label: T('Automatisch (NL, BE, MULTI, EN)') }, { id: '_save', label: T('Opslaan') });
                Dialog.menu({ title: T('Talen in genres'), text: T('Kies met OK welke talen meetellen. Bij dubbele titels wint de taal die het hoogst in deze lijst staat.'), items: items, index: index }, function (it, i) {
                    if (!it) return;
                    if (it.id === '_save' || it.id === '_all' || it.id === '_auto') {
                        Store.setSetting('genreLangs', it.id === '_auto' ? null : it.id === '_all' ? [] : langs.filter(function (l) { return chosen.indexOf(l) >= 0; }));
                        Genres.reset();
                        Toast.show('Genres: ' + self.langsLabel());
                        self.render(self.list.index);
                        return;
                    }
                    var j = chosen.indexOf(it.id);
                    if (j >= 0) chosen.splice(j, 1); else chosen.push(it.id);
                    open(i);
                });
            };
            open(0);
        }).catch(function (e) { Loader.hide(); Dialog.alert(T('Laden mislukt'), e.message); });
    },

    pinMenu: function () {
        var self = this, cur = Store.settings().pin;
        var items = cur ? [{ id: 'change', label: T('Pincode wijzigen') }, { id: 'off', label: T('Pincode uitschakelen'), danger: true }] : [{ id: 'set', label: T('Pincode instellen') }];
        Dialog.menu({ title: T('Pincode'), text: T('De pincode beveiligt de instellingen (en daarmee profielen en het 18+-filter). Het is een eenvoudig kinderslot, geen echte beveiliging.'), items: items }, function (it) {
            if (!it) return;
            if (it.id === 'off') { Store.setSetting('pin', ''); Toast.show(T('Pincode uitgeschakeld')); self.render(self.list.index); return; }
            Dialog.pin(T('Nieuwe pincode'), function (a) {
                if (!a) return;
                Dialog.pin(T('Herhaal pincode'), function (b) {
                    if (!b) return;
                    if (a !== b) { Toast.show(T('Pincodes komen niet overeen')); return; }
                    Store.setSetting('pin', a);
                    Toast.show(T('Pincode ingesteld'));
                    self.render(self.list.index);
                });
            });
        });
    },

    accountInfo: function () {
        var a = Api.account();
        if (!a) { Dialog.alert(T('Account'), T('Niet verbonden met een server.')); return; }
        var ui = a.user_info || {}, si = a.server_info || {}, p = Store.activeProfile();
        var lines = [
            T('Gebruiker: {user}', { user: ui.username || (p && p.username) || '–' }),
            T('Status: {status}', { status: ui.status || '–' }),
            App.expiryText(),
            T('Verbindingen: {active} van {max} in gebruik', { active: ui.active_cons != null ? ui.active_cons : '?', max: ui.max_connections || '?' }),
            T('Formaten: {formats}', { formats: U.toArr(ui.allowed_output_formats).join(', ') }),
            T('Server: {server}', { server: Api.normalizeServer(p && p.server) + (si.timezone ? ' (' + si.timezone + ')' : '') })
        ];
        Dialog.alert(T('Account'), lines.join('\n'));
    }
};
