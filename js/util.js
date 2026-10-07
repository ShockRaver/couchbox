/* Algemene hulpfuncties */
var U = (function () {
    'use strict';

    // Klein hulpje om DOM-elementen te bouwen: h('div', {class: 'x', text: 'y'}, [kinderen])
    function h(tag, attrs, children) {
        var el = document.createElement(tag);
        if (attrs) {
            for (var k in attrs) {
                var v = attrs[k];
                if (v == null || v === false) continue;
                if (k === 'class') el.className = v;
                else if (k === 'text') el.textContent = v;
                else if (k === 'html') el.innerHTML = v;
                else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
                else el.setAttribute(k, v);
            }
        }
        if (children != null) {
            (Array.isArray(children) ? children : [children]).forEach(function (c) {
                if (c == null || c === false) return;
                el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
            });
        }
        return el;
    }

    var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    // Milliseconden -> 1:02:03 of 12:03
    function fmtTime(ms) {
        var s = Math.max(0, Math.floor((ms || 0) / 1000));
        var hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
        return hh ? hh + ':' + pad(mm) + ':' + pad(ss) : mm + ':' + pad(ss);
    }
    function fmtClock(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

    // Datum in de gekozen taal: "di 6 okt" / "Tue 6 Oct" (met jaar: "6 okt 2026")
    function fmtDate(t, withYear) {
        var d = new Date(t);
        return (withYear ? '' : I18N.days()[d.getDay()] + ' ') + d.getDate() + ' ' + I18N.months()[d.getMonth()] + (withYear ? ' ' + d.getFullYear() : '');
    }

    // Base64 (UTF-8) decoderen, gebruikt door de Xtream EPG
    function b64(s) {
        if (!s) return '';
        try { return decodeURIComponent(escape(atob(s))); } catch (e) {
            try { return atob(s); } catch (e2) { return String(s); }
        }
    }

    function debounce(fn, ms) {
        var t;
        return function () {
            var a = arguments, self = this;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(self, a); }, ms);
        };
    }

    // Xtream geeft soms een object i.p.v. een array terug
    function toArr(x) {
        if (Array.isArray(x)) return x;
        if (x && typeof x === 'object') return Object.keys(x).map(function (k) { return x[k]; });
        return [];
    }

    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

    // Normaliseren voor zoeken: kleine letters, zonder accenten
    // Grote lijst in stukjes verwerken (geeft de TV tussendoor tijd om te tekenen en toetsen te verwerken)
    function each(list, fn, chunk) {
        var i = 0, n = list.length, size = chunk || 2000;
        return new Promise(function (resolve) {
            (function step() {
                var end = Math.min(n, i + size);
                for (; i < end; i++) fn(list[i], i);
                if (i < n) setTimeout(step, 0); else resolve();
            })();
        });
    }

    function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

    var LANGS = {
        nl: ['nl', 'nld', 'dut', 'dutch', 'nederlands', 'vlaams', 'flemish'],
        en: ['en', 'eng', 'english', 'engels'],
        de: ['de', 'deu', 'ger', 'german', 'deutsch'],
        fr: ['fr', 'fra', 'fre', 'french', 'francais'],
        es: ['es', 'spa', 'spanish'], it: ['it', 'ita', 'italian'], tr: ['tr', 'tur', 'turkish'],
        ar: ['ar', 'ara', 'arabic'], pl: ['pl', 'pol', 'polish'], pt: ['pt', 'por', 'portuguese'],
        el: ['el', 'ell', 'gre', 'greek', 'ελληνικά']
    };
    // Namen blijven Nederlands (sleutels voor de vertaling); langLabel vertaalt bij het tonen
    var LABELS = { nl: 'Nederlands', en: 'Engels', de: 'Duits', fr: 'Frans', es: 'Spaans', it: 'Italiaans', tr: 'Turks', ar: 'Arabisch', pl: 'Pools', pt: 'Portugees', el: 'Grieks' };
    function normLang(code) {
        var c = String(code || '').toLowerCase().trim();
        for (var k in LANGS) if (LANGS[k].indexOf(c) >= 0) return k;
        return c;
    }
    function langLabel(code) { var n = normLang(code); return LABELS[n] ? T(LABELS[n]) : (n ? n.toUpperCase() : T('Onbekend')); }

    // Initialen als placeholder voor ontbrekende logo's/posters ("NL | NPO 1" -> "N1")
    function initials(name) {
        var s = String(name || '').replace(/^[A-Z]{2,4}\s*[|:\-]\s*/, '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/)
            .filter(function (w, i) { return i === 0 || !/^(of|the|and|a|an|de|het|een|en|van|der|la|le)$/i.test(w); });
        return (((s[0] || '')[0] || '') + ((s[1] || '')[0] || '')).toUpperCase();
    }

    // Afbeelding met placeholder; eerder geladen URL's direct tonen (geen flikkering bij herrenderen)
    var loadedSrc = {};
    function img(src, cls, name) {
        var w = h('div', { class: (cls || '') + ' ph', 'data-ph': initials(name) });
        if (src && /^https?:\/\//i.test(src)) {
            var i = document.createElement('img');
            i.decoding = 'async';
            i.loading = 'lazy';   // pas laden als de kaart (bijna) in beeld komt
            if (loadedSrc[src]) w.classList.add('loaded');
            i.onload = function () { loadedSrc[src] = 1; w.classList.add('loaded'); };
            i.onerror = function () { w.classList.remove('loaded'); if (i.parentNode) i.parentNode.removeChild(i); };
            i.src = src;
            w.appendChild(i);
        }
        return w;
    }

    return {
        h: h, esc: esc, pad: pad, clamp: clamp, fmtTime: fmtTime, fmtClock: fmtClock, fmtDate: fmtDate,
        b64: b64, each: each, debounce: debounce, toArr: toArr, uid: uid, norm: norm, normLang: normLang,
        langLabel: langLabel, initials: initials, img: img
    };
})();
