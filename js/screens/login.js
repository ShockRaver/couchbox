/* Inlogscherm: Xtream-server en gegevens invoeren (nieuw of bestaand profiel bewerken) */
Screens.login = {
    build: function () {
        var self = this;
        this.el = UI.screen('login');
        var card = U.h('div', { class: 'login-card' });
        card.appendChild(U.h('div', { class: 'login-logo', html: Icons.logo() + '<span>Kijkdoos</span>' }));
        this.titleEl = U.h('h1', { text: 'Verbinden met je IPTV-server' });
        card.appendChild(this.titleEl);
        card.appendChild(U.h('p', { class: 'muted', text: 'Vul je Xtream Codes-gegevens in. Ze worden alleen lokaal op deze TV opgeslagen.' }));
        this.fields = [
            { key: 'name', label: 'Naam van dit profiel', ph: 'Bijv. Thuis' },
            { key: 'server', label: 'Server-URL (met poort)', ph: 'http://voorbeeld.com:8080', type: 'url' },
            { key: 'username', label: 'Gebruikersnaam' },
            { key: 'password', label: 'Wachtwoord', type: 'password' }
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
        this.btnConnect = U.h('div', { class: 'btn primary', html: Icons.get('play') + '<span>Verbinden</span>' });
        this.btnCancel = U.h('div', { class: 'btn', text: 'Annuleren' });
        card.appendChild(U.h('div', { class: 'btn-row' }, [this.btnConnect, this.btnCancel]));
        this.items.push({ el: this.btnConnect, action: 'connect' }, { el: this.btnCancel, action: 'cancel' });
        this.err = U.h('div', { class: 'login-error' });
        card.appendChild(this.err);
        card.appendChild(U.h('p', { class: 'muted small', text: 'Tip: vul "demo" in als server-URL om de app te proberen zonder abonnement.' }));
        this.el.appendChild(card);
    },

    show: function (p) {
        this.editing = p.profile || null;
        this.first = Store.profiles().length === 0;
        var v = this.editing || {};
        this.fields.forEach(function (f) { f.input.value = v[f.key] || ''; });
        this.titleEl.textContent = this.editing ? 'Profiel bewerken' : 'Verbinden met je IPTV-server';
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
        var server = Api.normalizeServer(v.server);
        if (!server) return this.error('Vul de server-URL in');
        if (server !== 'demo' && (!v.username || !v.password)) return this.error('Vul gebruikersnaam en wachtwoord in');
        var name = v.name || (server === 'demo' ? 'Demo' : server.replace(/^https?:\/\//, '').replace(/:\d+$/, ''));
        var p = { id: this.editing ? this.editing.id : U.uid(), name: name, server: v.server, username: v.username, password: v.password };
        var prev = Store.activeProfile();
        Api.setProfile(p);
        this.error('');
        Loader.show('Verbinden met ' + name + '…');
        Api.login().then(function () {
            Loader.hide();
            Store.saveProfile(p);
            Store.setActive(p.id);
            EPG.reset();
            Toast.show('Verbonden met ' + name);
            App.reset('home');
        }).catch(function (e) {
            Loader.hide();
            Api.setProfile(prev);
            self.error(e.message + (Player.isNative() || server === 'demo' ? '' : ' (let op: in een desktopbrowser blokkeert CORS vaak de verbinding)'));
        });
    },

    error: function (t) { this.err.textContent = t || ''; }
};
