/* Instellingen (optioneel beveiligd met pincode) */
Screens.settings = {
    // Labels blijven hier Nederlands (de taal is bij het laden nog niet bekend); T() pas bij het tonen
    OPTS: {
        startup: [['none', 'Startscherm'], ['live', 'Laatste zender afspelen'], ['ask', 'Vragen: verder kijken?']],
        liveFormat: [['m3u8', 'HLS (.m3u8)'], ['ts', 'MPEG-TS (.ts)']],
        audioLang: [['auto', 'Automatisch'], ['nl', 'Nederlands'], ['en', 'Engels'], ['de', 'Duits'], ['fr', 'Frans'], ['es', 'Spaans'], ['el', 'Grieks'], ['it', 'Italiaans'], ['pl', 'Pools'], ['tr', 'Turks']],
        subLang: [['auto', 'Automatisch (als er maar één is)'], ['off', 'Uit'], ['nl', 'Nederlands'], ['en', 'Engels'], ['de', 'Duits'], ['fr', 'Frans'], ['es', 'Spaans'], ['el', 'Grieks'], ['it', 'Italiaans'], ['pl', 'Pools'], ['tr', 'Turks']],
        aspect: [['letterbox', 'Passend (zwarte balken)'], ['fill', 'Uitrekken tot volledig scherm'], ['auto', 'Automatisch']],
        subSize: [['s', 'Klein'], ['m', 'Normaal'], ['l', 'Groot'], ['xl', 'Extra groot']],
        osAuto: [[true, 'Aan'], [false, 'Uit']],
        hideAdult: [[false, 'Gewoon tonen'], [true, 'Verbergen'], ['lock', 'Op slot (pincode)']],
        trailer: [['app', 'In Kijkdoos'], ['youtube', 'In de YouTube-app']],
        autoNext: [['on', 'Automatisch na 10 seconden'], ['ask', 'Vragen'], ['off', 'Uit']]
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
            { id: 'lang', label: T('Taal'), value: I18N.LANGS[I18N.lang()], action: true },
            { id: 'profile', label: T('Profiel'), value: p ? p.name : '–', action: true },
            { id: 'startup', label: T('Bij opstarten') },
            { id: 'liveFormat', label: T('Live-streamformaat') },
            { id: 'audioLang', label: T('Voorkeur audiotaal') },
            { id: 'subLang', label: T('Voorkeur ondertitels') },
            { id: 'subSize', label: T('Grootte van ondertitels') },
            { id: 'opensubs', label: T('Online ondertitels (OpenSubtitles)'), value: Subs.enabled() ? T('Aan') : T('Uit: druk op OK om een sleutel in te voeren'), action: true },
            Subs.enabled() ? { id: 'osAuto', label: T('Automatisch online zoeken als de stream je taal niet heeft') } : null,
            { id: 'aspect', label: T('Beeldweergave') },
            { id: 'autoNext', label: T('Volgende aflevering afspelen') },
            { id: 'hideAdult', label: T('18+ categorieën') },
            { id: 'lineup', label: T('Verborgen zenders en groepen'), value: this.lineupLabel(), action: true },
            { id: 'epgSrc', label: T('Bron van de tv-gids'), value: this.epgLabel(), action: true },
            App.canEmbed() ? { id: 'trailer', label: T('Trailers afspelen') } : null,
            { id: 'genreLangs', label: T('Talen in genres (films & series)'), value: this.langsLabel(), action: true },
            { id: 'tmdb', label: T('TMDB-gegevens (genres, posters, info)'), value: Tmdb.status(), action: true },
            { id: 'pin', label: T('Pincode voor instellingen'), value: s.pin ? T('Aan') : T('Uit'), action: true },
            { id: 'account', label: T('Account'), value: ui ? (ui.status || '') + ' · ' + App.expiryText() : T('Niet verbonden'), action: true },
            { id: 'refresh', label: T('Zenders, films en gids vernieuwen'), value: '', action: true },
            { id: 'history', label: T('Kijkgeschiedenis wissen'), value: '', action: true },
            { id: 'about', label: T('Over deze app'), value: T('versie {version}', { version: App.VERSION }) + (BUILD.date ? '  ·  ' + BUILD.date : ''), action: true }
        ].filter(Boolean);
    },

    render: function (idx) {
        this.list.setItems(this.rows(), idx);
        this.hdr.sub.textContent = T('◀ ▶ waarde wijzigen · OK kiezen');
    },

    valueLabel: function (id) {
        var v = Store.settings()[id], o = this.OPTS[id];
        var hit = o.filter(function (x) { return x[0] === v; })[0];
        if (!hit) return String(v);
        return T(hit[1]);
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
        if (id === 'aspect') Player.applyAspect();
        if (id === 'hideAdult') {
            App.relock();
            Genres.reset();
            // Op slot zonder pincode kan niet: eerst een pincode instellen (geannuleerd = terug naar de vorige keuze)
            if (n === 'lock' && !Store.settings().pin) {
                var self = this;
                this.newPin(function (ok) { if (!ok) Store.setSetting(id, v); self.render(self.list.index); });
            }
        }
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
            case 'lineup': this.lineupMenu(); break;
            case 'lang': I18N.choose(); break;
            case 'epgSrc': this.epgMenu(); break;
            case 'tmdb': this.tmdbMenu(); break;
            case 'opensubs': this.osMenu(); break;
            case 'history':
                Dialog.ask(T('Kijkgeschiedenis wissen?'), T('Verder kijken en de "bekeken"-vinkjes van dit profiel worden gewist.'), function (yes) {
                    if (yes) { Store.clearHistory(); Toast.show(T('Kijkgeschiedenis gewist')); }
                }, T('Wissen'));
                break;
            case 'about':
                Dialog.notice('Kijkdoos ' + App.VERSION, (BUILD.date ? T('Geïnstalleerd op {date} (commit {commit})', { date: BUILD.date, commit: BUILD.commit }) + '\n\n' : '') + T('Speler voor je eigen IPTV-abonnement. Kijkdoos bevat zelf geen zenders, films of series.\nAfspelen via Samsung AVPlay (HLS, MPEG-TS, MP4, MKV).\n\nJe gegevens worden alleen lokaal op deze TV opgeslagen; er gaat niets naar de makers van Kijkdoos.\n\nFilm- en seriegegevens: The Movie Database (TMDB). Deze app gebruikt de TMDB API, maar wordt niet door TMDB onderschreven of gecertificeerd.') + (CONFIG.privacyUrl ? '\n\n' + T('Privacyverklaring: {url}', { url: CONFIG.privacyUrl }) : ''));
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
                Dialog.notice(T('Dit lijkt geen TMDB-sleutel'), T('Een TMDB-sleutel ("API Key", niet de lange "Read Access Token") bestaat uit 32 tekens: cijfers en de letters a t/m f. Je typte {n} tekens.', { n: v.length }));
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
                Dialog.notice(T('Sleutel werkt niet'), (e && e.message) || T('TMDB weigert deze sleutel.'));
            });
        });
    },

    // ---- OpenSubtitles: eigen API-sleutel (gratis account op opensubtitles.com) ----
    osMenu: function () {
        var self = this, own = (Store.settings().osKey || '').trim();
        if (!Subs.enabled()) { this.osKeyEntry(function () { self.render(self.list.index); }); return; }
        var items = [{ id: 'key', label: own ? T('Sleutel wijzigen') : T('Eigen sleutel invoeren') }];
        if (own) items.push({ id: 'del', label: T('Sleutel van deze TV verwijderen'), danger: true });
        Dialog.menu({
            title: T('Online ondertitels (OpenSubtitles)'),
            text: T('Ondertitels zoeken voor films en afleveringen die ze zelf niet hebben: in de speler ▼ → Ondertitels → Online zoeken. Gekozen ondertitels worden per titel onthouden; bij series ook de taal voor de volgende afleveringen. OpenSubtitles staat een beperkt aantal downloads per dag toe.'),
            items: items
        }, function (it) {
            if (!it) return;
            if (it.id === 'key') self.osKeyEntry(function () { self.render(self.list.index); });
            else { Store.setSetting('osKey', ''); Toast.show(T('Sleutel verwijderd')); self.render(self.list.index); }
        });
    },
    // Sleutel invoeren, eerst bij OpenSubtitles controleren, dan pas opslaan; cb(true) als het gelukt is
    osKeyEntry: function (cb) {
        Dialog.text({
            title: T('OpenSubtitles-sleutel'),
            text: T('Maak gratis een account op opensubtitles.com, ga naar "API consumers", maak een consumer aan en typ de "API key" hier over (ABC = hoofdletters).'),
            value: Store.settings().osKey || '', placeholder: T('bv. AbC123…'), okLabel: T('Controleren en opslaan'), url: true
        }, function (v) {
            if (v == null) return cb && cb(false);
            v = v.replace(/\s+/g, '');
            if (!v) return cb && cb(false);
            if (!/^[A-Za-z0-9]{16,64}$/.test(v)) {
                Dialog.notice(T('Dit lijkt geen OpenSubtitles-sleutel'), T('Een sleutel bestaat uit letters en cijfers (meestal 32 tekens). Je typte {n} tekens.', { n: v.length }));
                return cb && cb(false);
            }
            var old = Store.settings().osKey || '';
            Store.setSetting('osKey', v);
            Loader.show(T('Sleutel controleren bij OpenSubtitles…'));
            // Zoeken kost geen download; met een verkeerde sleutel weigert de API
            Subs.req('subtitles', { languages: 'en', tmdb_id: '603' }).then(function () {
                Loader.hide();
                Toast.show(T('Sleutel werkt en is opgeslagen'));
                if (cb) cb(true);
            }).catch(function (e) {
                Loader.hide();
                Store.setSetting('osKey', old);
                Dialog.notice(T('Sleutel werkt niet'), e.message);
                if (cb) cb(false);
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
            var j = self.list.items.findIndex(function (r) { return r.id === 'epgSrc'; });
            if (j >= 0) { self.list.items[j].value = self.epgLabel(); self.list.refreshItem(j); }
        }, 3000);
    },
    hide: function () { clearInterval(this.tick); },

    // ---- Bron van de tv-gids: provider (per zender), XMLTV van de provider, of een eigen XMLTV-adres ----
    epgLabel: function () {
        var src = Xmltv.source(), st = Xmltv.status();
        var name = src.mode === 'xmltv' ? T('Provider (XMLTV)') : src.mode === 'url' ? T('Eigen XMLTV-adres') : T('Provider (standaard)');
        return name + (st ? ' · ' + st : '');
    },
    epgMenu: function () {
        var self = this, src = Xmltv.source();
        var items = [
            { id: 'api', label: T('Provider (standaard)'), hint: T('per zender opgevraagd'), checked: src.mode === 'api' },
            { id: 'xmltv', label: T('Provider (XMLTV)'), hint: T('volledige gids, vaak completer'), checked: src.mode === 'xmltv' },
            { id: 'url', label: T('Eigen XMLTV-adres…'), hint: src.mode === 'url' ? src.url.replace(/^https?:\/\//, '').slice(0, 40) : '', checked: src.mode === 'url' }
        ];
        if (src.mode !== 'api') items.push({ id: 'now', label: T('Gids nu vernieuwen') });
        Dialog.menu({
            title: T('Bron van de tv-gids'),
            text: T('Een XMLTV-gids wordt één keer per 12 uur gedownload en vult de gids voor alle zenders tegelijk. Zenders die er niet in staan, houden de gids van de provider. Koppeling per zender aanpassen: houd in de TV-gids OK ingedrukt.'),
            items: items
        }, function (it) {
            if (!it) return;
            if (it.id === 'api') { Xmltv.setSource({ mode: 'api' }); EPG.reset(); self.render(self.list.index); }
            else if (it.id === 'xmltv') { Xmltv.setSource({ mode: 'xmltv' }); self.loadEpg(); }
            else if (it.id === 'now') self.loadEpg();
            else if (it.id === 'url') Dialog.text({
                title: T('XMLTV-adres'), text: T('Bijvoorbeeld https://example.com/epg.xml.gz (ABC = hoofdletters)'),
                value: src.mode === 'url' ? src.url : 'https://', okLabel: T('Gebruiken'), url: true
            }, function (v) {
                if (!v) return;
                if (!/^https?:\/\/[^\s/]+\.[^\s]+/i.test(v)) { Dialog.notice(T('Ongeldig adres'), T('Een adres begint met http:// of https://')); return; }
                Xmltv.setSource({ mode: 'url', url: v });
                self.loadEpg();
            });
        });
    },
    // Gids downloaden met voortgang in de statusregel; daarna melden hoeveel zenders gekoppeld zijn
    loadEpg: function () {
        var self = this;
        self.render(self.list.index);
        Toast.show(T('Tv-gids downloaden…'));
        Xmltv.refresh(true).then(function (m) {
            if (m) Toast.show(T('Tv-gids bijgewerkt: {n} van {total} zenders', { n: m.matched, total: m.total }), 5000);
            if (App.screen() === self) self.render(self.list.index);
        }).catch(function (e) {
            if (App.screen() === self) self.render(self.list.index);
            Dialog.notice(T('Tv-gids laden mislukt'), e.message + '\n\n' + T('Zolang gebruikt Kijkdoos de gids van de provider.'));
        });
    },

    lineupLabel: function () {
        var d = Store.getP('lineup', null) || {}, n = (d.hideCats || []).length + (d.hideCh || []).length;
        return n ? T('{n} verborgen', { n: n }) : T('Geen');
    },
    // Verborgen groepen en zenders weer tonen; volgorde van de groepen herstellen
    lineupMenu: function () {
        var self = this;
        Lineup.load().then(function (L) {
            var items = [];
            L.hiddenCats.forEach(function (c) { items.push({ id: 'c', ref: c.id, label: T('Groep tonen: {name}', { name: c.name }) }); });
            L.hiddenChannels.forEach(function (s) { items.push({ id: 'h', ref: s.stream_id, label: T('Zender tonen: {name}', { name: s.name }) }); });
            if (items.length > 1) items.unshift({ id: 'all', label: T('Alles weer tonen') });
            var none = !items.length;
            items.push({ id: 'order', label: T('Volgorde van groepen herstellen') });
            Dialog.menu({
                title: T('Verborgen zenders en groepen'),
                text: none ? T('Er is niets verborgen. Verbergen, verplaatsen en eigen zenderlijsten: houd in Live TV OK ingedrukt op een zender of groep.')
                    : T('Kies wat je weer wilt tonen.'),
                items: items
            }, function (it) {
                if (!it) return;
                if (it.id === 'all') Lineup.showAll();
                else if (it.id === 'c') Lineup.hideCat(it.ref, false);
                else if (it.id === 'h') Lineup.hideChannel(it.ref, false);
                else Lineup.resetOrder();
                Toast.show(it.id === 'order' ? T('Volgorde hersteld') : T('Weer zichtbaar'));
                self.render(self.list.index);
                if (it.id === 'c' || it.id === 'h') self.lineupMenu();
            });
        }).catch(function (e) { Dialog.notice(T('Zenders laden mislukt'), e.message); });
    },

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
        }).catch(function (e) { Loader.hide(); Dialog.notice(T('Laden mislukt'), e.message); });
    },

    pinMenu: function () {
        var self = this, cur = Store.settings().pin;
        var items = cur ? [{ id: 'change', label: T('Pincode wijzigen') }, { id: 'off', label: T('Pincode uitschakelen'), danger: true }] : [{ id: 'set', label: T('Pincode instellen') }];
        if (cur && App.isUnlocked()) items.unshift({ id: 'relock', label: T('Categorieën nu weer op slot') });
        Dialog.menu({
            title: T('Pincode'),
            text: T('De pincode beveiligt de instellingen en categorieën die op slot staan (zet een categorie op slot: houd OK ingedrukt op de categorie). Eén keer de pincode invoeren ontgrendelt alles tot de app naar de achtergrond gaat. Het is een eenvoudig kinderslot, geen echte beveiliging.'),
            items: items
        }, function (it) {
            if (!it) return;
            if (it.id === 'relock') { App.relock(); Toast.show(T('Weer op slot')); return; }
            if (it.id === 'off') { Store.setSetting('pin', ''); Toast.show(T('Pincode uitgeschakeld')); self.render(self.list.index); return; }
            self.newPin(function () { self.render(self.list.index); });
        });
    },
    // Nieuwe pincode instellen (twee keer invoeren); cb(true) als het gelukt is
    newPin: function (cb) {
        Dialog.pin(T('Nieuwe pincode'), function (a) {
            if (!a) return cb && cb(false);
            Dialog.pin(T('Herhaal pincode'), function (b) {
                if (!b) return cb && cb(false);
                if (a !== b) { Toast.show(T('Pincodes komen niet overeen')); return cb && cb(false); }
                Store.setSetting('pin', a);
                Toast.show(T('Pincode ingesteld'));
                if (cb) cb(true);
            });
        });
    },

    accountInfo: function () {
        var a = Api.account();
        if (!a) { Dialog.notice(T('Account'), T('Niet verbonden met een server.')); return; }
        var ui = a.user_info || {}, si = a.server_info || {}, p = Store.activeProfile();
        var lines = [
            T('Gebruiker: {user}', { user: ui.username || (p && p.username) || '–' }),
            T('Status: {status}', { status: ui.status || '–' }),
            App.expiryText(),
            T('Verbindingen: {active} van {max} in gebruik', { active: ui.active_cons != null ? ui.active_cons : '?', max: ui.max_connections || '?' }),
            T('Formaten: {formats}', { formats: U.toArr(ui.allowed_output_formats).join(', ') }),
            T('Server: {server}', { server: Api.normalizeServer(p && p.server) + (si.timezone ? ' (' + si.timezone + ')' : '') })
        ];
        Dialog.notice(T('Account'), lines.join('\n'));
    }
};
