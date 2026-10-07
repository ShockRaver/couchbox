/* Trailer afspelen in Kijkdoos zelf, met de ingebouwde YouTube-speler (geen inlogscherm van de YouTube-app).
   Blokkeert YouTube het afspelen (foutmelding van de speler), dan openen we de trailer alsnog in de YouTube-app.
   OK = pauze, ▼ = in de YouTube-app openen, Terug = sluiten. */
Screens.trailer = {
    build: function () {
        var self = this;
        this.el = UI.screen('trailer', 'trailer');
        this.frameBox = U.h('div', { class: 'tr-frame' });
        this.titleEl = U.h('div', { class: 'tr-title' });
        this.hint = U.h('div', { class: 'tr-hint' });
        this.bar = U.h('div', { class: 'tr-bar' }, [this.titleEl, this.hint]);
        this.msg = U.h('div', { class: 'tr-msg' });
        [this.frameBox, this.msg, this.bar].forEach(function (e) { self.el.appendChild(e); });
        // Berichten van de YouTube-speler (klaar, status, fout)
        window.addEventListener('message', function (e) { self.onMessage(e); });
    },

    show: function (p) {
        var self = this;
        this.p = p;
        this.ready = false;
        this.paused = false;
        this.failed = false;
        this.titleEl.textContent = p.title ? T('Trailer: {title}', { title: p.title }) : T('Trailer');
        this.hint.innerHTML = T('<b>OK</b> pauze · <b>▼</b> openen in de YouTube-app · <b>Terug</b> sluiten');
        this.showMsg('');
        // origin alleen meegeven als de app via http(s) draait (browser); op de TV is de pagina een lokaal bestand
        var origin = /^https?:$/.test(location.protocol) ? '&origin=' + encodeURIComponent(location.origin) : '';
        this.frame = U.h('iframe', {
            src: 'https://www.youtube.com/embed/' + encodeURIComponent(p.key) + '?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1&hl=' + I18N.lang() + origin,
            allow: 'autoplay; encrypted-media; fullscreen', frameborder: '0', tabindex: '-1'
        });
        this.frameBox.innerHTML = '';
        this.frameBox.appendChild(this.frame);
        this.frame.addEventListener('load', function () { self.listen(); });
        this.showBar();
        // Geen teken van leven van de speler? Dan de uitweg naar de YouTube-app duidelijk tonen
        clearTimeout(this.waitT);
        this.waitT = setTimeout(function () {
            if (!self.ready && App.screen() === self) self.showMsg(T('Speelt de trailer niet af? Druk op ▼ om hem in de YouTube-app te openen.'));
        }, 10000);
    },

    hide: function () {
        clearTimeout(this.waitT); clearInterval(this.lisT); clearTimeout(this.barT);
        this.frameBox.innerHTML = '';
        this.frame = null;
    },

    // De speler stuurt pas berichten als we laten weten dat we luisteren; een paar keer proberen
    listen: function () {
        var self = this, n = 0;
        clearInterval(this.lisT);
        this.lisT = setInterval(function () {
            if (self.ready || ++n > 10) { clearInterval(self.lisT); return; }
            self.post({ event: 'listening', id: 1, channel: 'widget' });
        }, 500);
    },
    post: function (o) { try { if (this.frame) this.frame.contentWindow.postMessage(JSON.stringify(o), '*'); } catch (e) { /* speler nog niet klaar */ } },
    command: function (func) { this.post({ event: 'command', func: func, args: [] }); },

    onMessage: function (e) {
        if (!this.frame || e.source !== this.frame.contentWindow) return;
        var d;
        try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (x) { return; }
        if (!d || !d.event) return;
        if (d.event === 'onReady' || d.event === 'initialDelivery' || d.event === 'infoDelivery') {
            if (!this.ready) { this.ready = true; clearTimeout(this.waitT); this.showMsg(''); }
        }
        // Afgelopen (status 0): terug naar de film of serie
        var state = d.event === 'onStateChange' ? d.info : d.event === 'infoDelivery' && d.info ? d.info.playerState : null;
        if (state === 0 && App.screen() === this) App.back();
        if (d.event === 'onError') this.fallback();
    },

    // YouTube staat afspelen hier niet toe: alsnog in de YouTube-app openen
    fallback: function () {
        if (this.failed) return;
        this.failed = true;
        var p = this.p;
        if (App.screen() === this) App.back();
        Toast.show(T('Deze trailer kan niet in Kijkdoos spelen; hij opent in de YouTube-app'), 4000);
        App.trailerApp(p.key, p.title);
    },

    showMsg: function (t) { this.msg.textContent = t || ''; this.msg.style.display = t ? '' : 'none'; },
    showBar: function () {
        var self = this;
        this.bar.classList.add('show');
        clearTimeout(this.barT);
        this.barT = setTimeout(function () { self.bar.classList.remove('show'); }, 4000);
    },

    onKey: function (k) {
        this.showBar();
        switch (k) {
            case 'ok': case 'play': case 'pause': case 'playpause':
                this.paused = k === 'play' ? false : k === 'pause' ? true : !this.paused;
                this.command(this.paused ? 'pauseVideo' : 'playVideo');
                return true;
            case 'down':
                var p = this.p;
                App.back();
                App.trailerApp(p.key, p.title);
                return true;
            case 'stop': App.back(); return true;
            case 'up': case 'left': case 'right': return true;
        }
        return false;
    }
};
