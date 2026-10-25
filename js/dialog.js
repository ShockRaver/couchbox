/* Dialogen: keuzemenu, bevestiging, melding en pincode-invoer */
var Dialog = (function () {
    'use strict';

    var stack = [], root = null;

    function init() { root = document.getElementById('overlay'); }
    function isOpen() { return stack.length > 0; }
    function push(d) { stack.push(d); root.appendChild(d.el); root.classList.add('show'); }
    function close(d) {
        stack = stack.filter(function (x) { return x !== d; });
        if (d.el.parentNode) d.el.parentNode.removeChild(d.el);
        if (!stack.length) root.classList.remove('show');
    }
    function onKey(k) { var d = stack[stack.length - 1]; if (d) d.onKey(k); }
    // Teken van een gewoon toetsenbord; true als het bovenste venster tekst accepteert
    function onChar(ch) { var d = stack[stack.length - 1]; if (!d || !d.onChar) return false; d.onChar(ch); return true; }

    // o: {title, text, items: [{id, label, checked, hint}], index}; cb(item|null)
    // Optioneel: image (poster), imageName (voor de placeholder) en progress (0..1, voortgangsbalk)
    function menu(o, cb) {
        var box = U.h('div', { class: 'dialog' + (o.image != null ? ' has-img' : '') });
        var main = o.image != null ? U.h('div', { class: 'dialog-main' }) : box;
        if (o.image != null) box.appendChild(U.img(o.image, 'dialog-img', o.imageName || o.title));
        if (main !== box) box.appendChild(main);
        if (o.title) main.appendChild(U.h('h2', { text: o.title }));
        if (o.text) main.appendChild(U.h('p', { class: 'dialog-text', text: o.text }));
        if (o.progress) { var pb = UI.pbar(o.progress); pb.classList.add('dialog-pbar'); main.appendChild(pb); }
        if (o.tmdb) main.appendChild(UI.tmdbCredit());
        var vis = Math.min(o.items.length, 8);
        var listEl = U.h('div', { class: 'dialog-list' });
        listEl.style.height = (vis * 76) + 'px';
        main.appendChild(listEl);
        var d = { el: U.h('div', { class: 'dialog-wrap' }, box) };
        push(d);
        var list = new VList(listEl, {
            itemH: 76, visible: vis,
            render: function (it) {
                return U.h('div', { class: 'dialog-item' + (it.danger ? ' danger' : '') }, [
                    U.h('span', { class: 'di-label', text: it.label }),
                    it.hint ? U.h('span', { class: 'di-hint', text: it.hint }) : null,
                    it.checked ? U.h('span', { class: 'di-check', html: Icons.get('check') }) : null
                ]);
            }
        });
        var start = o.index != null ? o.index : o.items.findIndex(function (i) { return i.checked; });
        list.setActive(true);
        list.setItems(o.items, Math.max(0, start));
        d.onKey = function (k) {
            if (k === 'up' || k === 'down') list.move(k);
            else if (k === 'chup' || k === 'chdown') list.page(k === 'chup' ? -1 : 1);
            else if (k === 'ok') { close(d); if (cb) cb(o.items[list.index], list.index); }
            else if (k === 'back') { close(d); if (cb) cb(null); }
        };
        return d;
    }

    // Tekst invoeren met het toetsenbord op het scherm. o: {title, text, value, placeholder, okLabel, url}; cb(tekst|null)
    // url: true = toetsenbord met hoofdletters en leestekens (internetadressen)
    function text(o, cb) {
        var value = o.value || '', btnIdx = 0, zone = 'keys';
        var shown = U.h('span', { class: 'sk-text' });
        var field = U.h('div', { class: 'sk-query dlg-query' }, [shown, U.h('i', { class: 'sk-caret' })]);
        var kb = new Keyboard(function (id) {
            if (id === 'space') value += ' ';
            else if (id === 'del') value = value.slice(0, -1);
            else if (id === 'clear') value = '';
            else value += id;
            draw();
        }, o.url ? Keyboard.URL : null);
        var btns = [{ id: 'ok', label: o.okLabel || T('Opslaan') }, { id: 'cancel', label: T('Annuleren') }].map(function (b) {
            b.el = U.h('div', { class: 'btn', text: b.label });
            return b;
        });
        var box = U.h('div', { class: 'dialog dlg-text' + (o.url ? ' url' : '') }, [
            U.h('h2', { text: o.title || '' }),
            o.text ? U.h('p', { class: 'dialog-text', text: o.text }) : null,
            field, kb.el,
            U.h('div', { class: 'btn-row' }, btns.map(function (b) { return b.el; }))
        ]);
        var d = { el: U.h('div', { class: 'dialog-wrap' }, box) };
        function draw() {
            shown.textContent = value || o.placeholder || '';
            shown.classList.toggle('empty', !value);
            kb.setActive(zone === 'keys');
            btns.forEach(function (b, i) { b.el.classList.toggle('focus', zone === 'btns' && i === btnIdx); });
        }
        function done(ok) { close(d); if (cb) cb(ok ? value.trim() : null); }
        d.onKey = function (k) {
            if (k === 'back') { done(false); return; }
            if (Keys.isDigit(k)) { value += k; draw(); return; }   // cijfertoetsen van de afstandsbediening
            if (zone === 'keys') {
                var r = kb.key(k);
                if (r === 'down' || r === 'right') { zone = 'btns'; draw(); }
                return;
            }
            if (k === 'left' || k === 'right') { btnIdx = k === 'left' ? 0 : 1; draw(); }
            else if (k === 'up') { zone = 'keys'; draw(); }
            else if (k === 'ok') done(btns[btnIdx].id === 'ok');
        };
        d.onChar = function (ch) {
            if (ch === '\b') value = value.slice(0, -1); else value += ch;
            draw();
        };
        push(d);
        draw();
        return d;
    }

    // Standaard staat de focus op "Annuleren", zodat een verdwaalde OK niets onomkeerbaars doet
    // Bevestigen (niet 'confirm' genoemd: Samsungs controle ziet dat als de ingebouwde browserfunctie)
    function ask(title, text, cb, yesLabel) {
        menu({ title: title, text: text, index: 1, items: [{ id: 'yes', label: yesLabel || T('Ja') }, { id: 'no', label: T('Annuleren') }] }, function (it) {
            cb(!!(it && it.id === 'yes'));
        });
    }

    // Melding met OK (niet 'alert' genoemd, om dezelfde reden)
    function notice(title, text, cb) {
        menu({ title: title, text: text, items: [{ id: 'ok', label: 'OK' }] }, function () { if (cb) cb(); });
    }

    // Pincode van 4 cijfers: cijfertoetsen, of ▲▼ om een cijfer te kiezen en ◀▶ om te verplaatsen
    function pin(title, cb) {
        var digits = ['', '', '', ''], pos = 0, editing = false;
        var boxes = digits.map(function () { return U.h('div', { class: 'pin-box' }); });
        var d = {
            el: U.h('div', { class: 'dialog-wrap' }, U.h('div', { class: 'dialog pin' }, [
                U.h('h2', { text: title }),
                U.h('div', { class: 'pin-row' }, boxes),
                U.h('p', { class: 'dialog-hint', text: T('Cijfertoetsen, of ▲▼ om te kiezen en ◀▶ om te verplaatsen · OK bevestigen · Terug annuleren') })
            ]))
        };
        function draw() {
            boxes.forEach(function (b, i) {
                b.textContent = digits[i] === '' ? '' : (i === pos && editing ? digits[i] : '•');
                b.classList.toggle('cur', i === pos);
            });
        }
        function full() { return digits.every(function (x) { return x !== ''; }); }
        function done() { close(d); cb(digits.join('')); }
        d.onKey = function (k) {
            if (Keys.isDigit(k)) {
                digits[pos] = k; editing = false;
                if (pos < 3) pos++; else if (full()) return done();
            } else if (k === 'up' || k === 'down') {
                var v = digits[pos] === '' ? (k === 'up' ? -1 : 10) : +digits[pos];
                digits[pos] = String((v + (k === 'up' ? 1 : -1) + 10) % 10);
                editing = true;
            } else if (k === 'left') { if (pos > 0) pos--; editing = false; }
            else if (k === 'right') { if (pos < 3 && digits[pos] !== '') pos++; editing = false; }
            else if (k === 'ok') { if (full()) return done(); if (digits[pos] !== '' && pos < 3) { pos++; editing = false; } }
            else if (k === 'back') { close(d); cb(null); return; }
            draw();
        };
        push(d);
        draw();
        return d;
    }

    return { init: init, isOpen: isOpen, onKey: onKey, onChar: onChar, menu: menu, text: text, ask: ask, notice: notice, pin: pin };
})();
