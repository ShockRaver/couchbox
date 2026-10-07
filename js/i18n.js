/* Vertalingen. Standaard Engels; Nederlands, Duits, Frans, Spaans, Grieks, Italiaans, Pools en Turks kunnen in Instellingen.
   In de code staat de Nederlandse tekst als sleutel:      T('Verder kijken')
   Variabelen met {naam}:                                  T('Omdat je {title} keek', { title: naam })
   Woordenboeken per taal in js/lang/<code>.js (sleutel = Nederlandse tekst, waarde = vertaling).
   Ontbreekt een vertaling, dan verschijnt de Nederlandse tekst (en een waarschuwing in de console).
   Nieuwe taal: hieronder in LANGS, een js/lang/<code>.js, script-tag in index.html, en controleren met scripts/i18n-check.js */
var I18N = (function () {
    'use strict';

    // Per taal: naam (in de taal zelf), TMDB-taalcode, locale voor getallen, korte dag- en maandnamen
    var CONF = {
        en: { name: 'English', tmdb: 'en-US', locale: 'en-GB', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
        nl: { name: 'Nederlands', tmdb: 'nl-NL', locale: 'nl-NL', days: ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'],
            months: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'] },
        de: { name: 'Deutsch', tmdb: 'de-DE', locale: 'de-DE', days: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
            months: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] },
        fr: { name: 'Français', tmdb: 'fr-FR', locale: 'fr-FR', days: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
            months: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'] },
        es: { name: 'Español', tmdb: 'es-ES', locale: 'es-ES', days: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
            months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'] },
        el: { name: 'Ελληνικά', tmdb: 'el-GR', locale: 'el-GR', days: ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'],
            months: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'] },
        it: { name: 'Italiano', tmdb: 'it-IT', locale: 'it-IT', days: ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'],
            months: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'] },
        pl: { name: 'Polski', tmdb: 'pl-PL', locale: 'pl-PL', days: ['nd', 'pn', 'wt', 'śr', 'czw', 'pt', 'sob'],
            months: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'] },
        tr: { name: 'Türkçe', tmdb: 'tr-TR', locale: 'tr-TR', days: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
            months: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'] }
    };
    var LANGS = {};
    Object.keys(CONF).forEach(function (l) { LANGS[l] = CONF[l].name; });
    var dict = {}, missing = {};
    var lang = 'en';

    // Taal uit de instellingen (bij het starten; wisselen = app herstarten, zodat alles in de nieuwe taal staat)
    function init() {
        var l = Store.settings().lang;
        lang = LANGS[l] ? l : 'en';
        document.documentElement.lang = lang;
    }

    function add(l, obj) { var d = dict[l] = dict[l] || {}; Object.keys(obj).forEach(function (k) { d[k] = obj[k]; }); }

    function t(key, params) {
        var s = key;
        if (lang !== 'nl') {
            var d = dict[lang] && dict[lang][key];
            if (d != null) s = d;
            else if (!missing[key]) { missing[key] = 1; console.warn('Geen vertaling (' + lang + '):', key); }
        }
        if (params) s = s.replace(/\{(\w+)\}/g, function (m, k) { return params[k] != null ? params[k] : m; });
        return s;
    }

    return {
        LANGS: LANGS, init: init, add: add, t: t,
        lang: function () { return lang; },
        days: function () { return CONF[lang].days; },
        months: function () { return CONF[lang].months; },
        // Taalcode voor TMDB-verzoeken en voor getallen (1.234 of 1,234)
        tmdb: function () { return CONF[lang].tmdb; },
        locale: function () { return CONF[lang].locale; },
        num: function (n) { return Number(n || 0).toLocaleString(CONF[lang].locale); },
        // Ontbrekende vertalingen (voor de controle in de browser)
        missing: function () { return Object.keys(missing); },
        has: function (key) { return lang === 'nl' || (dict[lang] && dict[lang][key] != null); },
        dict: function (l) { return dict[l || 'en']; },
        // Taal kiezen: bevestigen en dan de app opnieuw starten (alle schermen worden in de nieuwe taal opgebouwd)
        choose: function () {
            var items = Object.keys(CONF).map(function (l) { return { id: l, label: CONF[l].name, checked: l === lang }; });
            Dialog.menu({ title: t('Taal'), items: items }, function (it) {
                if (!it || it.id === lang) return;
                Dialog.confirm(t('Taal wijzigen naar {lang}?', { lang: it.label }), t('Kijkdoos start opnieuw op om alles in de nieuwe taal te tonen. Titels en beschrijvingen van TMDB worden daarna op de achtergrond bijgewerkt.'), function (yes) {
                    if (!yes) return;
                    Store.setSetting('lang', it.id);
                    Loader.show(t('Taal wijzigen…'));
                    setTimeout(function () { location.reload(); }, 300);
                }, t('Opnieuw starten'));
            });
        }
    };
})();
var T = I18N.t;
