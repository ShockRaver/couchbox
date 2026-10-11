/* Lokale opslag op de TV (localStorage): profielen, instellingen, favorieten, kijkgeschiedenis */
var Store = (function () {
    'use strict';

    var P = 'iptv.';
    var mem = {}; // cache van geparste waarden, zodat renders geen JSON hoeven te parsen

    function get(k, def) {
        if (!(k in mem)) {
            var v;
            try { var raw = localStorage.getItem(P + k); v = raw == null ? undefined : JSON.parse(raw); } catch (e) { v = undefined; }
            mem[k] = v;
        }
        return mem[k] === undefined ? def : mem[k];
    }
    function set(k, v) {
        mem[k] = v;
        try { localStorage.setItem(P + k, JSON.stringify(v)); return true; } catch (e) { console.warn('Opslaan mislukt', k, e); return false; }
    }
    function del(k) {
        delete mem[k];
        try { localStorage.removeItem(P + k); } catch (e) { /* negeren */ }
    }

    // ---- Instellingen (gelden voor alle profielen) ----
    var DEFAULTS = {
        lang: 'en',
        // taal van de app en van TMDB-gegevens: 'en' | 'nl'
        trailer: 'app',         // trailers: 'app' (in Kijkdoos) | 'youtube' (YouTube-app van de TV)
        autoNext: 'on',         // na een aflevering: 'on' (volgende na 10 s) | 'ask' (vragen, niet vanzelf) | 'off' (terug naar de serie)
        startup: 'none',        // bij opstarten: 'none' (startscherm) | 'live' (laatste zender) | 'ask' (verder kijken?)
        liveFormat: 'm3u8',     // 'm3u8' (HLS) of 'ts'
        audioLang: 'nl',        // 'auto' | 'nl' | 'en'
        subLang: 'off',         // 'off' | 'nl' | 'en'
        aspect: 'letterbox',    // 'letterbox' | 'fill' | 'auto'
        hideAdult: false,
        pin: ''
    };
    function settings() {
        var s = Object.assign({}, DEFAULTS, get('settings', {}));
        // Oude instelling "laatste zender afspelen" overnemen
        if (s.autoplay === true && get('settings', {}).startup == null) s.startup = 'live';
        return s;
    }
    function setSetting(key, val) { var s = settings(); s[key] = val; set('settings', s); return s; }

    // ---- Profielen (meerdere servers/logins) ----
    function profiles() { return get('profiles', []); }
    function activeProfile() {
        var id = get('active', null), list = profiles();
        return list.filter(function (p) { return p.id === id; })[0] || list[0] || null;
    }
    function saveProfile(p) {
        var list = profiles().slice();
        var i = list.findIndex(function (x) { return x.id === p.id; });
        if (i >= 0) list[i] = p; else list.push(p);
        set('profiles', list);
    }
    function deleteProfile(id) {
        set('profiles', profiles().filter(function (p) { return p.id !== id; }));
        ['fav', 'hist', 'last', 'livecat', 'seen', 'follow', 'lineup', 'guideGroup', 'liveFmt', 'epgSrc', 'epgMap'].forEach(function (k) { del('p.' + id + '.' + k); });
        if (get('active', null) === id) del('active');
    }
    function setActive(id) { set('active', id); }

    // Sleutel per actief profiel
    function pk(k) { var p = activeProfile(); return 'p.' + (p ? p.id : 'none') + '.' + k; }

    // ---- Favorieten: { live: [], movie: [], series: [] } ----
    function favs() { return get(pk('fav'), { live: [], movie: [], series: [] }); }
    function favorites(type) { return (favs()[type] || []).slice(); }
    function isFav(type, id) {
        var list = favs()[type] || [], s = String(id);
        for (var i = 0; i < list.length; i++) if (String(list[i].id) === s) return true;
        return false;
    }
    function toggleFav(type, item) {
        var all = Object.assign({ live: [], movie: [], series: [] }, favs());
        var list = (all[type] || []).slice();
        var i = list.findIndex(function (f) { return String(f.id) === String(item.id); });
        if (i >= 0) list.splice(i, 1); else list.push(item);
        all[type] = list;
        set(pk('fav'), all);
        return i < 0; // true = toegevoegd
    }
    // Volgorde aanpassen (zenderbeheer)
    function setFavorites(type, list) {
        var all = Object.assign({ live: [], movie: [], series: [] }, favs());
        all[type] = list;
        set(pk('fav'), all);
    }

    // ---- Verder kijken ----
    function history() { return get(pk('hist'), []); }
    function progress(key) { return history().filter(function (h) { return h.key === key; })[0] || null; }
    // Eén regel per film en één per serie (de laatst bekeken/volgende aflevering)
    function saveProgress(entry) {
        var sid = entry.series ? String(entry.series.id) : null;
        var list = history().filter(function (h) {
            return h.key !== entry.key && !(sid && h.series && String(h.series.id) === sid);
        });
        entry.t = Date.now();
        list.unshift(entry);
        set(pk('hist'), list.slice(0, 60));
    }
    // Velden van een regel aanvullen zonder de volgorde te wijzigen (bv. ontbrekend TMDB-id)
    function patchHistory(key, patch) {
        var list = history(), e = list.filter(function (h) { return h.key === key; })[0];
        if (!e) return;
        if (patch.seriesTmdb && e.series) e.series.tmdb = patch.seriesTmdb;
        if (patch.tmdb) e.tmdb = patch.tmdb;
        set(pk('hist'), list);
    }
    function removeProgress(key) { set(pk('hist'), history().filter(function (h) { return h.key !== key; })); }
    function clearHistory() { set(pk('hist'), []); set(pk('seen'), []); }

    // ---- Bekeken (vinkje bij films/afleveringen) ----
    function seen() { return get(pk('seen'), []); }
    function isSeen(key) { return seen().indexOf(key) >= 0; }
    function markSeen(key) { if (isSeen(key)) return; var l = seen().slice(); l.push(key); set(pk('seen'), l.slice(-3000)); }

    // ---- Laatste zender / categorie ----
    function lastChannel() { return get(pk('last'), null); }
    function setLastChannel(ch) { set(pk('last'), ch); }
    function liveCat() { return get(pk('livecat'), null); }
    function setLiveCat(id) { set(pk('livecat'), id); }

    return {
        // Algemene opslag, los van profielen (bv. TMDB-genres per titel)
        getGlobal: function (k, def) { return get('g.' + k, def); },
        setGlobal: function (k, v) { return set('g.' + k, v); },
        // Opslag per actief profiel (bv. gevolgde series)
        getP: function (k, def) { return get(pk(k), def); },
        setP: function (k, v) { return set(pk(k), v); },
        settings: settings, setSetting: setSetting,
        profiles: profiles, activeProfile: activeProfile, saveProfile: saveProfile, deleteProfile: deleteProfile, setActive: setActive,
        favorites: favorites, isFav: isFav, toggleFav: toggleFav, setFavorites: setFavorites,
        history: history, progress: progress, saveProgress: saveProgress, patchHistory: patchHistory, removeProgress: removeProgress, clearHistory: clearHistory,
        isSeen: isSeen, markSeen: markSeen,
        lastChannel: lastChannel, setLastChannel: setLastChannel, liveCat: liveCat, setLiveCat: setLiveCat
    };
})();
