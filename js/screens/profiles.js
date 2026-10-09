/* Profielen beheren: meerdere servers/abonnementen */
Screens.profiles = {
    build: function () {
        var self = this;
        this.el = UI.screen('profiles');
        this.hdr = UI.header(T('Profielen'));
        this.el.appendChild(this.hdr.el);
        var box = U.h('div', { class: 'settings-body' });
        this.el.appendChild(box);
        this.list = new VList(box, {
            itemH: 108, pad: 8,
            render: function (p) {
                if (p.add) return U.h('div', { class: 'prof-row add', html: Icons.get('plus') + '<div class="prof-name">' + T('Nieuw profiel toevoegen') + '</div>' });
                var active = Store.activeProfile(), on = active && active.id === p.id;
                return U.h('div', { class: 'prof-row' }, [
                    U.h('div', { html: Icons.get('user') }),
                    U.h('div', { class: 'prof-main' }, [U.h('div', { class: 'prof-name', text: p.name }), U.h('div', { class: 'prof-host', text: Api.normalizeServer(p.server) + (p.username ? ' · ' + p.username : '') })]),
                    on ? U.h('div', { class: 'prof-badge', text: T('Actief') }) : null
                ]);
            }
        });
        this.list.setActive(true);
        this.self = self;
    },
    show: function () { this.render(0); },
    resume: function () { this.render(this.list.index); },
    render: function (idx) {
        this.list.setItems(Store.profiles().concat([{ add: true }]), idx);
        this.hdr.sub.textContent = T('OK voor opties');
    },
    onKey: function (k) {
        var self = this;
        if (k === 'up' || k === 'down') { this.list.move(k); return true; }
        if (k !== 'ok') return false;
        var p = this.list.current();
        if (p.add) { App.go('login', {}); return true; }
        Dialog.menu({
            title: p.name,
            items: [{ id: 'use', label: T('Dit profiel gebruiken') }, { id: 'edit', label: T('Bewerken') }, { id: 'del', label: T('Verwijderen'), danger: true }]
        }, function (it) {
            if (!it) return;
            if (it.id === 'use') App.switchProfile(p);
            else if (it.id === 'edit') App.go('login', { profile: p });
            else if (it.id === 'del') {
                Dialog.ask(T('Profiel verwijderen?'), T('"{name}" en de bijbehorende favorieten en kijkgeschiedenis worden verwijderd.', { name: p.name }), function (yes) {
                    if (!yes) return;
                    var wasActive = Store.activeProfile() && Store.activeProfile().id === p.id;
                    Store.deleteProfile(p.id);
                    if (!Store.profiles().length) { Api.setProfile(null); App.reset('login', {}); return; }
                    if (wasActive) App.switchProfile(Store.profiles()[0]);
                    else self.render(0);
                }, T('Verwijderen'));
            }
        });
        return true;
    }
};
