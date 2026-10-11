/* Inlogscherm: server + gebruikersnaam/wachtwoord, of één link (Xtream-link of M3U-afspeellijst); nieuw of bestaand profiel */
Screens.login = {
    build: function () {
        var self = this;
        this.el = UI.screen('login');
        var card = U.h('div', { class: 'login-card' });
        card.appendChild(U.h('div', { class: 'login-logo', html: Icons.logo() + '<span>Kijkdoos</span>' }));
        this.titleEl = U.h('h1', { text: T('Verbinden met je IPTV-server') });
        card.appendChild(this.titleEl);
        card.appendChild(U.h('p', { class: 'muted', text: T('Vul de gegevens van je IPTV-provider in. Ze worden alleen lokaal op deze TV opgeslagen.') }));
        this.fields = [
            { key: 'name', label: T('Naam van dit profiel'), ph: T('Bijv. Thuis') },
            { key: 'server', label: T('Server-URL of afspeellijst-link'), ph: T('http://voorbeeld.com:8080'), type: 'url' },
            { key: 'username', label: T('Gebruikersnaam (niet nodig bij een link)') },
            { key: 'password', label: T('Wachtwoord (niet nodig bij een link)'), type: 'password' }
        ];
        this.items = [];
        this.fields.forEach(function (f) {
            f.input = U.h('input', { type: f.type || 'text', placeholder: f.ph || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
            var row = U.h('div', { class: 'field' }, [U.h('label', { text: f.label }), f.input]);
            card.appendChild(row);
            var idx = self.items.length;
            f.input.addEventListener('focus', function () { self.setFocus(idx); });
            self.items.push({ el: row, input: f.input });
        });
        this.btnConnect = U.h('div', { class: 'btn primary', html: Icons.get('play') + '<span>' + T('Verbinden') + '</span>' });
        this.btnCancel = U.h('div', { class: 'btn', text: T('Annuleren') });
        card.appendChild(U.h('div', { class: 'btn-row' }, [this.btnConnect, this.btnCancel]));
        this.items.push({ el: this.btnConnect, action: 'connect' }, { el: this.btnCancel, action: 'cancel' });
        this.err = U.h('div', { class: 'login-error' });
        card.appendChild(this.err);
        card.appendChild(U.h('p', { class: 'muted small', text: T('Je kunt ook één link invullen die je van je provider kreeg: een M3U-afspeellijst, of een link met get.php?username=…&password=…. Tip: vul "demo" in om de app te proberen zonder abonnement.') }));
        this.el.appendChild(card);
    },

    show: function (p) {
        this.editing = p.profile || null;
        this.first = Store.profiles().length === 0;
        var v = this.editing || {};
        this.fields.forEach(function (f) { f.input.value = (f.key === 'server' && v.type === 'm3u' ? v.url : v[f.key]) || ''; });
        this.titleEl.textContent = this.editing ? T('Profiel bewerken') : T('Verbinden met je IPTV-server');
        this.btnCancel.style.display = this.first ? 'none' : '';
        this.err.textContent = '';
        this.setFocus(0);
    },

    setFocus: function (i) {
        this.focus = i;
        this.items.forEach(function (it, j) { it.el.classList.toggle('focus', i === j); });
    },

    onKey: function (k) {
        var i = this.focus;
        switch (k) {
            case 'up': this.setFocus(i >= 4 ? 3 : Math.max(0, i - 1)); return true;
            case 'down': this.setFocus(i < 4 ? i + 1 : i); return true;
            case 'left': if (i === 5) this.setFocus(4); return true;
            case 'right': if (i === 4 && !this.first) this.setFocus(5); return true;
            case 'inputdone': this.setFocus(Math.min(4, i + 1)); return true;
            case 'ok':
                var it = this.items[i];
                if (it.input) it.input.focus();
                else if (it.action === 'connect') this.connect();
                else App.back();
                return true;
            case 'back':
                if (this.first) App.exitPrompt(); else App.back();
                return true;
        }
        return false;
    },

    connect: function () {
        var self = this, v = {};
        this.fields.forEach(function (f) { v[f.key] = f.input.value.trim(); });
        // Server, Xtream-link of M3U-afspeellijst herkennen
        var link = Api.parseLink(v.server, v.username, v.password);
        if (link.error) return this.error(link.error);
        var server = link.type === 'demo' ? 'demo' : link.server;
        var host = String(link.url || link.server).replace(/^https?:\/\//, '').replace(/[/:?].*$/, '');
        var name = v.name || (link.type === 'demo' ? 'Demo' : host);
        var p = { id: this.editing ? this.editing.id : U.uid(), name: name, type: link.type === 'm3u' ? 'm3u' : 'xtream',
            server: link.type === 'm3u' ? host : server, url: link.url || '', username: link.username, password: link.password };
        var prev = Store.activeProfile();
        Api.setProfile(p);
        this.error('');
        Loader.show(T('Verbinden met {name}…', { name: name }));
        Api.login().then(function () {
            Loader.hide();
            Store.saveProfile(p);
            Store.setActive(p.id);
            EPG.reset();
            Xmltv.reset();
            Toast.show(T('Verbonden met {name}', { name: name }));
            App.reset('home');
        }).catch(function (e) {
            Loader.hide();
            Api.setProfile(prev);
            self.error(Player.isNative() || server === 'demo' ? e.message : T('{error} (let op: in een desktopbrowser blokkeert CORS vaak de verbinding)', { error: e.message }));
        });
    },

    error: function (t) { this.err.textContent = t || ''; }
};
