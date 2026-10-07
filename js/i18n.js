/* Vertalingen. Standaard Engels; Nederlands kan in Instellingen.
   In de code staat de Nederlandse tekst als sleutel:      T('Verder kijken')
   Variabelen met {naam}:                                  T('Omdat je {title} keek', { title: naam })
   Het Engelse woordenboek staat in js/lang/en.js (sleutel = Nederlandse tekst, waarde = Engels).
   Ontbreekt een vertaling, dan verschijnt de Nederlandse tekst (en een waarschuwing in de console). */
var I18N = (function () {
    'use strict';

    var LANGS = { en: 'English', nl: 'Nederlands' };
    var dict = { en: {} }, missing = {};
    var lang = 'en';

    // Taal uit de instellingen (bij het starten; wisselen = app herstarten, zodat alles in de nieuwe taal staat)
    function init() {
        var l = Store.settings().lang;
        lang = LANGS[l] ? l : 'en';
        document.documentElement.lang = lang;
    }

    function add(l, obj) { Object.keys(obj).forEach(function (k) { dict[l][k] = obj[k]; }); }

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

    // Datums en getallen
    var DAYS = { nl: ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
    var MONTHS = {
        nl: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
        en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    };

    return {
        LANGS: LANGS, init: init, add: add, t: t,
        lang: function () { return lang; },
        days: function () { return DAYS[lang]; },
        months: function () { return MONTHS[lang]; },
        // Taalcode voor TMDB-verzoeken en voor getallen (1.234 of 1,234)
        tmdb: function () { return lang === 'nl' ? 'nl-NL' : 'en-US'; },
        locale: function () { return lang === 'nl' ? 'nl-NL' : 'en-GB'; },
        num: function (n) { return Number(n || 0).toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-GB'); },
        // Ontbrekende vertalingen (voor de controle in de browser)
        missing: function () { return Object.keys(missing); },
        has: function (key) { return lang === 'nl' || (dict[lang] && dict[lang][key] != null); },
        dict: function (l) { return dict[l || 'en']; }
    };
})();
var T = I18N.t;
