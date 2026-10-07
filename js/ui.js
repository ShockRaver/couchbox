/* Gedeelde UI-bouwstenen: iconen, headers, kaarten, rijen, toast en laadscherm */
var Icons = (function () {
    var P = {
        tv: '<rect x="2" y="5" width="20" height="13" rx="2"/><path d="M8 21h8M12 18v3"/>',
        film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4"/>',
        series: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M7 4h10M9 1.5h6"/>',
        guide: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h8"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
        settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
        star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/>',
        play: '<path d="M7 4.5v15l12.5-7.5z"/>',
        pause: '<path d="M6.5 4h4v16h-4zM13.5 4h4v16h-4z"/>',
        list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.5M3.5 12h.5M3.5 18h.5"/>',
        audio: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
        subs: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 12h4M13 12h5M6 15.5h8M16.5 15.5h1.5"/>',
        aspect: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 12V9h3M18 12v3h-3"/>',
        next: '<path d="M5 5v14l10-7z"/><path d="M19 5v14"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        restart: '<path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3L3.5 8.3"/><path d="M3.5 3.5v4.8h4.8"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        bookmark: '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
        bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
        backspace: '<path d="M21 5H9l-6 7 6 7h12z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
        lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
    };
    var FILLED = { star: 1, play: 1, pause: 1, next: 1 };
    function get(name) {
        var attrs = FILLED[name] ? 'fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"'
            : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
        return '<svg class="ic" viewBox="0 0 24 24" ' + attrs + '>' + (P[name] || '') + '</svg>';
    }
    // Logo van Kijkdoos: kartonnen doosje met ogen (zelfde ontwerp als icon.png)
    function logo() {
        return '<svg class="logo" viewBox="0 0 64 56">' +
            '<path d="M12 20L7 11l10 1.5 1.5 7.5zM52 20l5-9-10 1.5-1.5 7.5z" fill="#e8992c"/>' +
            '<path d="M9.5 23h45l-3.5-5H13z" fill="#f9c870"/>' +
            '<rect x="9.5" y="22.5" width="45" height="30" rx="3" fill="#f2a93b"/>' +
            '<rect x="28" y="22.5" width="8" height="4" fill="#f6d9a4"/>' +
            '<ellipse cx="23.5" cy="36" rx="6" ry="7" fill="#fff"/><ellipse cx="40.5" cy="36" rx="6" ry="7" fill="#fff"/>' +
            '<ellipse cx="24.8" cy="37.3" rx="3" ry="3.3" fill="#1e1b4b"/><ellipse cx="41.8" cy="37.3" rx="3" ry="3.3" fill="#1e1b4b"/>' +
            '<circle cx="25.8" cy="35.6" r="1.1" fill="#fff"/><circle cx="42.8" cy="35.6" r="1.1" fill="#fff"/>' +
            '<path d="M28.5 45.5q3.5 2.6 7 0" fill="none" stroke="#1e1b4b" stroke-width="1.8" stroke-linecap="round"/>' +
            '</svg>';
    }
    return { get: get, logo: logo };
})();

var Screens = {};

var UI = {
    screen: function (id, cls) {
        var el = U.h('section', { class: 'screen ' + (cls || ''), id: 'screen-' + id });
        document.getElementById('screens').appendChild(el);
        return el;
    },

    header: function (title) {
        var t = U.h('div', { class: 'hdr-title', text: title });
        var sub = U.h('div', { class: 'hdr-sub' });
        var right = U.h('div', { class: 'hdr-right' }, U.h('div', { class: 'clock', text: U.fmtClock(Date.now()) }));
        return { el: U.h('header', { class: 'hdr' }, [t, sub, right]), title: t, sub: sub, right: right };
    },

    // Beeldkwaliteit uit de naam: ['4K', 'HDR'] (alleen wat opvalt; HD is te gewoon om te tonen)
    quality: function (name) {
        var n = ' ' + String(name || '').toLowerCase() + ' ', q = [];
        if (/[^a-z0-9](4k|uhd|2160p?)[^a-z0-9]/.test(n)) q.push('4K');
        if (/[^a-z0-9](hdr10\+?|hdr|dolby ?vision)[^a-z0-9]/.test(n)) q.push('HDR');
        return q;
    },
    qualityTags: function (q, cls) { return q && q.length ? U.h('div', { class: 'qtags' + (cls ? ' ' + cls : '') }, q.map(function (x) { return U.h('span', { class: 'qtag', text: x }); })) : null; },

    // Waardering als ster-icoon met cijfer (0-10 of 0-100)
    rating: function (r) { return '<span class="rating">' + Icons.get('star') + (r > 10 ? r / 10 : r).toFixed(1) + '</span>'; },

    pbar: function (frac) {
        var i = U.h('i');
        i.style.width = (U.clamp(frac || 0, 0, 1) * 100).toFixed(1) + '%';
        return U.h('div', { class: 'pbar' }, i);
    },

    // Voortgang van een programma (0..1)
    frac: function (p) { return p ? (Date.now() - p.start) / Math.max(1, p.end - p.start) : 0; },

    // Posterkaart voor films/series: {name, icon, rating, fav, progress, seen, sub}
    posterCard: function (o) {
        var card = U.h('div', { class: 'card' + (o.sub ? ' has-sub' : '') + (o.small ? ' sm' : '') }, [
            U.img(o.icon, 'poster', o.name),
            U.h('div', { class: 'card-title', text: o.name || '' }),
            o.sub ? U.h('div', { class: 'card-sub', text: o.sub }) : null
        ]);
        var r = parseFloat(o.rating);
        if (r > 0) card.appendChild(U.h('div', { class: 'badge', html: Icons.get('star') + (r > 10 ? r / 10 : r).toFixed(1) }));
        if (o.fav) card.appendChild(U.h('div', { class: 'card-fav', html: Icons.get('star') }));
        var qt = UI.qualityTags(o.q, o.fav ? 'with-fav' : '');
        if (qt) card.appendChild(qt);
        if (o.seen) card.appendChild(U.h('div', { class: 'card-seen', html: Icons.get('check') }));
        if (o.progress) { var pb = UI.pbar(o.progress); pb.classList.add('card-pbar'); card.appendChild(pb); }
        if (o.tag) card.appendChild(U.h('div', { class: 'card-tag', text: o.tag }));
        return card;
    },

    // Persoonskaart (acteur/regisseur): ronde foto, naam en rol
    personCard: function (p) {
        return U.h('div', { class: 'pcard' }, [
            U.img(Meta.img(p.img, 'w185'), 'pcard-img', p.name),
            U.h('div', { class: 'pcard-name', text: p.name }),
            p.role ? U.h('div', { class: 'pcard-role', text: Meta.roleText(p.role) }) : null
        ]);
    },

    // Kaart voor een film of serie uit de bibliotheek, met TMDB-poster/rating als aanvulling
    libCard: function (type, it, extra) {
        var movie = type === 'm', id = movie ? it.stream_id : it.series_id;
        return UI.posterCard(Object.assign({
            name: it.name, icon: Meta.poster(type, it, movie ? it.stream_icon : it.cover), rating: Meta.rating(type, it), q: UI.quality(it.name),
            fav: Store.isFav(movie ? 'movie' : 'series', id)
        }, extra || {}));
    },

    // Aanbevelingsrij (Reco) als rij voor RowStack: items zijn { type: 'm'|'t', item }
    recoRow: function (r, at) {
        return {
            id: r.id, title: r.title, items: r.items, itemW: 184, itemH: 320, at: at,
            render: function (x) { return UI.libCard(x.type, x.item, { small: true, sub: x.sub || '' }); },
            onSelect: function (x) { UI.openLib(x.type, x.item); }
        };
    },

    // Film of serie uit de bibliotheek openen
    openLib: function (type, it) {
        if (type === 'm') App.go('movie', { item: it }); else App.go('series', { item: it });
    },

    // Zenderkaart met logo
    logoCard: function (ch, tag) {
        var nn = EPG.nowNext(ch.stream_id);
        return U.h('div', { class: 'lcard' }, [
            U.img(ch.stream_icon, 'lcard-logo', ch.name),
            U.h('div', { class: 'lcard-name', text: ch.name }),
            U.h('div', { class: 'lcard-now', text: nn && nn.cur ? nn.cur.title : '' }),
            tag ? U.h('div', { class: 'lcard-tag', text: tag }) : null,
            UI.qualityTags(UI.quality(ch.name), 'on-logo')
        ]);
    }
};

/* Verticale stapel van horizontale rijen (startscherm, zoeken) */
function RowStack(box) {
    this.box = box;
    this.wrap = U.h('div', { class: 'rows-wrap' });
    box.appendChild(this.wrap);
    this.rows = [];
    this.cur = 0;
    this.y = 0;
    this.active = false;
    this.alignTop = box.classList.contains('nf-rows');
}
RowStack.prototype.clear = function () { this.wrap.innerHTML = ''; this.rows = []; this.cur = 0; };
RowStack.prototype.add = function (o) {
    var el = U.h('div', { class: 'hrow' + (o.cls ? ' ' + o.cls : '') });
    if (o.title) el.appendChild(U.h('h3', { text: o.title }));
    var lb = U.h('div', { class: 'hrow-list' });
    lb.style.height = (o.itemH + 28) + 'px';
    el.appendChild(lb);
    // o.at: rij op een bepaalde plek invoegen (bv. aanbevelingen die later binnenkomen)
    var at = o.at != null && o.at < this.rows.length ? o.at : this.rows.length;
    if (at < this.rows.length) this.wrap.insertBefore(el, this.rows[at].el); else this.wrap.appendChild(el);
    var list = new VList(lb, { horizontal: true, itemW: o.itemW, itemH: o.itemH, pad: 14, render: o.render });
    list.setItems(o.items, o.index || 0);
    var row = { id: o.id, el: el, list: list, o: o };
    this.rows.splice(at, 0, row);
    return row;
};
RowStack.prototype.state = function () {
    var st = { cur: this.rows[this.cur] ? this.rows[this.cur].id : null, idx: {} };
    this.rows.forEach(function (r) { st.idx[r.id] = r.list.index; });
    return st;
};
RowStack.prototype.restore = function (st) {
    var self = this;
    this.cur = 0;
    if (st) {
        this.rows.forEach(function (r, i) {
            if (st.idx[r.id] != null) r.list.focus(st.idx[r.id]);
            if (r.id === st.cur) self.cur = i;
        });
    }
    this.draw();
};
RowStack.prototype.setActive = function (b) { this.active = b; this.draw(); };
RowStack.prototype.draw = function () {
    var self = this;
    this.rows.forEach(function (r, i) {
        var on = self.active && i === self.cur;
        r.el.classList.toggle('cur', on);
        // Rijen ver buiten beeld niet tekenen (scheelt veel werk op de TV tijdens het scrollen)
        r.el.classList.toggle('far', i < self.cur - 1 || i > self.cur + 4);
        if (r.list.active !== on) r.list.setActive(on);
    });
    var r = this.rows[this.cur];
    if (!r) { this.wrap.style.transform = ''; return; }
    // Verticaal scrollen zodat de actieve rij volledig in beeld is
    var top = r.el.offsetTop, hgt = r.el.offsetHeight, view = this.box.clientHeight, y = this.y;
    if (this.alignTop) y = top; // streaming-stijl: geselecteerde rij altijd bovenaan
    else if (top < y) y = top;
    else if (top + hgt > y + view) y = top + hgt - view;
    if (this.cur === 0) y = 0;
    this.y = y;
    this.wrap.style.transform = 'translateY(' + (-y) + 'px)';
};
RowStack.prototype.move = function (k) {
    if (k === 'up' || k === 'down') {
        var n = this.cur + (k === 'up' ? -1 : 1);
        if (n < 0 || n >= this.rows.length) return false;
        this.cur = n;
        this.draw();
        return true;
    }
    var r = this.rows[this.cur];
    return r ? r.list.move(k) : false;
};
RowStack.prototype.current = function () { var r = this.rows[this.cur]; return r ? r.list.current() : null; };
RowStack.prototype.select = function () {
    var r = this.rows[this.cur];
    if (r && r.list.items.length && r.o.onSelect) r.o.onSelect(r.list.current(), r.list.index, r.list.items);
};

var Toast = {
    t: null,
    show: function (text, ms) {
        var el = document.getElementById('toast');
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(this.t);
        this.t = setTimeout(function () { el.classList.remove('show'); }, ms || 2500);
    }
};

var Loader = {
    n: 0,
    show: function (text) {
        this.n++;
        var el = document.getElementById('loader');
        el.querySelector('.loader-text').textContent = text || T('Laden…');
        el.classList.add('show');
    },
    hide: function () {
        this.n = Math.max(0, this.n - 1);
        if (!this.n) document.getElementById('loader').classList.remove('show');
    },
    active: function () { return this.n > 0; }
};

/* ---- Netflix-stijl bouwstenen ---- */

/* Menubalk bovenaan (Home, Live TV, Films, Series, TV-gids, Mijn lijst + zoeken/instellingen) */
function TopNav(active) {
    var self = this;
    this.items = [
        { id: 'search', icon: 'search', label: T('Zoeken') }, { id: 'home', label: T('Home') }, { id: 'live', label: T('Live TV') },
        { id: 'movie', label: T('Films') }, { id: 'series', label: T('Series') }, { id: 'guide', label: T('TV-gids') },
        { id: 'mylist', label: T('Mijn lijst') }, { id: 'settings', icon: 'settings', label: T('Instellingen') }
    ];
    this.active = active;
    this.index = Math.max(0, this.items.findIndex(function (x) { return x.id === active; }));
    this.focused = false;
    this.itemEls = this.items.map(function (x) {
        return U.h('div', { class: 'tn-item' + (x.icon ? ' tn-icon' : ''), html: x.icon ? Icons.get(x.icon) : U.esc(x.label) });
    });
    this.el = U.h('nav', { class: 'topnav' }, [
        U.h('div', { class: 'tn-brand', html: Icons.logo() + '<span>Kijkdoos</span>' }),
        U.h('div', { class: 'tn-items' }, this.itemEls),
        U.h('div', { class: 'tn-right' }, [U.h('div', { class: 'clock', text: U.fmtClock(Date.now()) })])
    ]);
    this.draw();
}
TopNav.prototype.draw = function () {
    var self = this;
    this.itemEls.forEach(function (el, i) {
        el.classList.toggle('cur', self.items[i].id === self.active);
        el.classList.toggle('focus', self.focused && i === self.index);
    });
    this.el.classList.toggle('focused', this.focused);
};
TopNav.prototype.setFocus = function (b) {
    this.focused = b;
    if (b) this.index = Math.max(0, this.items.findIndex(function (x) { return x.id === this.active; }, this));
    this.draw();
};
// Toetsen in het menu; geeft 'down' terug als de focus terug naar de inhoud moet
TopNav.prototype.key = function (k) {
    if (k === 'left' || k === 'right') { this.index = U.clamp(this.index + (k === 'left' ? -1 : 1), 0, this.items.length - 1); this.draw(); return true; }
    if (k === 'ok') { App.section(this.items[this.index].id); return true; }
    return false;
};

/* Menu bovenaan toevoegen aan een scherm met lijsten (Live TV, TV-gids, Instellingen, Categorieën).
   Het scherm roept scr.navFocus(true) aan als 'omhoog' bovenaan de lijst niet verder kan;
   zolang het menu focus heeft, gaan toetsen naar het menu en is de focus in de lijst gedimd. */
UI.addNav = function (scr, active) {
    var inner = scr.onKey, show = scr.show;
    scr.show = function () { scr.navFocus(false); return show.apply(scr, arguments); };
    scr.nav = new TopNav(active);
    scr.el.appendChild(scr.nav.el);
    scr.el.classList.add('has-nav');
    scr.navOn = false;
    scr.navFocus = function (b) {
        scr.navOn = !!b;
        scr.nav.setFocus(scr.navOn);
        scr.el.classList.toggle('nav-on', scr.navOn);
    };
    scr.onKey = function (k) {
        if (!scr.navOn) return inner.call(scr, k);
        if (k === 'down' || k === 'back') { scr.navFocus(false); return true; }
        if (k === 'longok') k = 'ok';
        return scr.nav.key(k) || k === 'up';
    };
};

/* Toetsenbord op het scherm (zoeken, TMDB-sleutel): acties bovenaan, daarna a-z en 0-9 in 6 kolommen.
   onPress(id): 'space', 'del', 'clear' of een teken. key(k) geeft 'up'/'down'/'right' terug als de focus het toetsenbord verlaat. */
function Keyboard(onPress) {
    var self = this;
    this.onPress = onPress;
    this.el = U.h('div', { class: 'sk-keys' });
    this.rows = Keyboard.LAYOUT.map(function (row) {
        var list = typeof row === 'string'
            ? row.split('').map(function (ch, i) { return { id: ch, label: ch, c: i, w: 1 }; })
            : row.map(function (k, i) { return { id: k[0], label: k[1], c: i * 2, w: 2 }; });
        list.forEach(function (k) {
            k.el = U.h('div', { class: 'sk-key' + (k.w > 1 ? ' wide' : ''), html: k.id === 'del' ? Icons.get('backspace') : U.esc(k.id === 'space' ? T('Spatie') : k.id === 'clear' ? T('Wissen') : k.label) });
            self.el.appendChild(k.el);
        });
        return list;
    });
    this.r = 1;
    this.i = 0;
    this.active = false;
}
Keyboard.LAYOUT = [[['space', 'Spatie'], ['del', ''], ['clear', 'Wissen']], 'abcdef', 'ghijkl', 'mnopqr', 'stuvwx', 'yz1234', '567890'];
Keyboard.prototype.setActive = function (b) { this.active = b; this.draw(); };
Keyboard.prototype.draw = function () {
    var self = this;
    this.rows.forEach(function (row, r) {
        row.forEach(function (k, i) { k.el.classList.toggle('focus', self.active && r === self.r && i === self.i); });
    });
};
// Toets in een andere rij die onder/boven de huidige ligt
Keyboard.prototype.below = function (r) {
    var k = this.rows[this.r][this.i], mid = k.c + k.w / 2 - 0.5, row = this.rows[r];
    for (var i = 0; i < row.length; i++) if (mid >= row[i].c && mid < row[i].c + row[i].w) return i;
    return row.length - 1;
};
Keyboard.prototype.key = function (k) {
    var row = this.rows[this.r];
    switch (k) {
        case 'left': if (this.i > 0) { this.i--; this.draw(); } return true;
        case 'right': if (this.i < row.length - 1) { this.i++; this.draw(); return true; } return 'right';
        case 'up': if (this.r === 0) return 'up'; this.i = this.below(this.r - 1); this.r--; this.draw(); return true;
        case 'down': if (this.r < this.rows.length - 1) { this.i = this.below(this.r + 1); this.r++; this.draw(); return true; } return 'down';
        case 'ok': this.onPress(row[this.i].id); return true;
    }
    return false;
};

/* Groot "hero"-blok bovenaan: backdrop, titel, gegevens en beschrijving van het geselecteerde item */
function Hero(box) {
    this.box = box;
    box.classList.add('hero-box');
    this.bg = U.h('div', { class: 'hero-bg' });
    this.logo = U.h('div', { class: 'hero-logo' });
    this.titleEl = U.h('div', { class: 'hero-title' });
    this.metaEl = U.h('div', { class: 'meta hero-meta' });
    this.plotEl = U.h('div', { class: 'hero-plot' });
    this.extraEl = U.h('div', { class: 'hero-extra' });
    box.appendChild(this.bg);
    box.appendChild(U.h('div', { class: 'hero-shade' }));
    this.posterEl = U.h('div', { class: 'hero-poster2' });
    box.appendChild(this.posterEl);
    box.appendChild(U.h('div', { class: 'hero-text' }, [this.logo, this.titleEl, this.metaEl, this.plotEl, this.extraEl]));
    this.token = 0;
}
Hero.prototype.set = function (d) {
    var bd = d.backdrop || '', self = this;
    if (bd !== this.curBg) {
        this.curBg = bd;
        var bg = this.bg;
        var swap = function () {
            if (self.curBg !== bd) return;
            bg.style.opacity = '0';
            setTimeout(function () {
                if (self.curBg !== bd) return;
                bg.style.backgroundImage = bd ? 'url("' + bd.replace(/"/g, '%22') + '")' : 'none';
                bg.style.opacity = bd ? '1' : '0';
            }, 120);
        };
        // Grote achtergrondfoto eerst op de achtergrond laden en decoderen, dan pas wisselen (geen hapering of leeg vlak)
        if (bd) { var im = new Image(); im.decoding = 'async'; im.onload = swap; im.onerror = swap; im.src = bd; } else swap();
    }
    this.posterEl.innerHTML = '';
    this.posterEl.style.display = d.poster ? '' : 'none';
    if (d.poster) this.posterEl.appendChild(U.img(d.poster, 'hero-poster-img', d.title));
    this.logo.innerHTML = '';
    if (d.logo != null) this.logo.appendChild(U.img(d.logo, 'hero-chlogo', d.title));
    this.titleEl.textContent = d.title || '';
    this.metaEl.innerHTML = (d.meta || []).join('<span class="dot">·</span>');
    this.plotEl.textContent = d.plot || '';
    this.extraEl.innerHTML = d.extra || '';
};
// Film ('m') of serie ('t') uit de bibliotheek; beschrijving volgt na een korte pauze via de metadata-service
// Film ('m') of serie ('t') uit de bibliotheek. Beschrijving/genres volgen na een korte pauze via de metadata-service.
// Ontbreekt het TMDB-id (bv. oude "Verder kijken"-regels), dan wordt het via de provider opgezocht; onTmdb(id) kan het bewaren.
Hero.prototype.forItem = function (type, item, extra, onTmdb) {
    var self = this, my = ++this.token, m = Meta.info(type, item), id = Tmdb.idOf(item);
    var meta = [], r = Meta.rating(type, item);
    if (r > 0) meta.push(UI.rating(r));
    if (m && m.year) meta.push(String(m.year));
    if (m && type === 'm' && m.runtime) meta.push(App.durText(m.runtime * 60));
    if (m && type === 't' && m.seasons) meta.push(m.seasons === 1 ? T('{n} seizoen', { n: 1 }) : T('{n} seizoenen', { n: m.seasons }));
    var bd = (m && m.backdrop && Meta.img(m.backdrop, 'w1280')) || U.toArr(item.backdrop_path)[0] || '';
    // Geen backdrop? Dan in elk geval de poster tonen
    var poster = bd ? '' : ((m && m.poster && Meta.img(m.poster, 'w500')) || (type === 'm' ? item.stream_icon : item.cover) || item.icon || '');
    this.set({ title: (m && m.title) || item.name, meta: meta, plot: item.plot || '', backdrop: bd, poster: poster, extra: extra || '' });
    clearTimeout(this.detT);
    if (!id) {
        var pid = type === 'm' ? item.stream_id : item.series_id;
        if (pid == null || item._tried) return;
        App.tmdbFor(type, pid).then(function (tid) {
            if (!tid || my !== self.token) return;
            if (onTmdb) onTmdb(tid);
            self.forItem(type, Object.assign({}, item, { tmdb: tid, _tried: true }), extra, null);
        });
        return;
    }
    var needBasics = !m || !m.backdrop;
    this.detT = setTimeout(function () {
        Meta.details(type, id).then(function (det) {
            if (!det || my !== self.token) return;
            // Basisgegevens (backdrop) kwamen nu pas binnen: opnieuw tonen
            var m2 = Meta.byId(type, id);
            if (needBasics && m2 && m2.backdrop) { self.forItem(type, item, extra, null); if (self.onUpdate) self.onUpdate(); return; }
            if (det.genres.length) { meta.push(U.esc(det.genres.slice(0, 2).join(', '))); self.metaEl.innerHTML = meta.join('<span class="dot">·</span>'); }
            if (det.overview) self.plotEl.textContent = det.overview;
        });
    }, needBasics ? 0 : 600);
};
Hero.prototype.forChannel = function (ch) {
    ++this.token;
    var nn = EPG.nowNext(ch.stream_id), plot = '';
    if (nn && nn.cur) plot = T('Nu: {title}', { title: nn.cur.title }) + (nn.next ? '   ·   ' + T('Straks {time}: {title}', { time: U.fmtClock(nn.next.start), title: nn.next.title }) : '');
    this.set({ title: ch.name, meta: ch.num ? [T('Zender {num}', { num: ch.num })] : [], plot: plot, backdrop: '', logo: ch.stream_icon || '' });
    var self = this;
    if (!nn) EPG.request(ch.stream_id, 4, function () { if (self.lastCh === ch) self.forChannel(ch); });
    this.lastCh = ch;
};
Hero.prototype.message = function (title, plot) { ++this.token; this.set({ title: title, plot: plot, backdrop: '' }); };

/* Brede kaart (16:9) voor "Verder kijken": backdrop, titel erover, voortgang eronder */
UI.wideCard = function (o) {
    var card = U.h('div', { class: 'wcard' }, [
        U.img(o.image, 'wcard-img', o.name),
        U.h('div', { class: 'wcard-title', text: o.name || '' }),
        o.sub ? U.h('div', { class: 'wcard-sub', text: o.sub }) : null
    ]);
    if (o.progress) { var pb = UI.pbar(o.progress); pb.classList.add('wcard-pbar'); card.appendChild(pb); }
    if (o.tag) card.appendChild(U.h('div', { class: 'card-tag wcard-tag', text: o.tag }));
    return card;
};

// Brede afbeelding voor een titel: TMDB-backdrop, anders de poster van de provider
UI.wideImage = function (type, item, fallback) {
    var m = Meta.info(type, item);
    return (m && m.backdrop && Meta.img(m.backdrop, 'w780')) || fallback || (m && Meta.img(m.poster, 'w342')) || '';
};

// "Verder kijken"-kaart en bijbehorende hero (gedeeld door startscherm en Films/Series)
UI.histCard = function (h) {
    var ep = h.mode === 'episode' && h.series;
    return UI.wideCard({
        name: ep ? h.series.name : h.name,
        sub: App.historyLabel(h),
        image: ep ? UI.wideImage('t', { tmdb: h.series.tmdb }, h.series.icon) : UI.wideImage('m', { tmdb: h.tmdb }, h.icon),
        progress: h.duration ? Math.max(0.02, h.position / h.duration) : 0,
        tag: h.upNext ? T('Volgende') : ''
    });
};
UI.heroHistory = function (hero, h) {
    var ep = h.mode === 'episode' && h.series;
    var extra = Icons.get('play') + '<b>' + (h.upNext ? '' : U.esc(T('Verder kijken')) + ' · ') + '</b>' + U.esc(App.historyLabel(h, true));
    var save = function (tid) { Store.patchHistory(h.key, ep ? { seriesTmdb: tid } : { tmdb: tid }); if (hero.onUpdate) hero.onUpdate(); };
    if (ep) hero.forItem('t', { series_id: h.series.id, name: h.series.name, tmdb: h.series.tmdb, cover: h.series.icon }, extra, save);
    else hero.forItem('m', { stream_id: h.id, name: h.name, tmdb: h.tmdb, stream_icon: h.icon }, extra, save);
};
