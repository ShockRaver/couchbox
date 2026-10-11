/* Kleine IndexedDB-wrapper: grotere lokale opslag dan localStorage (metadata van titels en personen) */
var Db = (function () {
    'use strict';

    var NAME = 'kijkdoos', VERSION = 3, STORES = ['titles', 'details', 'people', 'lists', 'epg'];
    var dbp = null;

    function open() {
        if (dbp) return dbp;
        dbp = new Promise(function (resolve, reject) {
            if (!window.indexedDB) { reject(new Error('IndexedDB niet beschikbaar')); return; }
            var r = indexedDB.open(NAME, VERSION);
            r.onupgradeneeded = function () {
                var d = r.result;
                STORES.forEach(function (n) { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); });
            };
            r.onsuccess = function () { resolve(r.result); };
            r.onerror = function () { reject(r.error || new Error('Database openen mislukt')); };
        });
        dbp.catch(function () { dbp = null; });
        return dbp;
    }

    // Voert fn(store) uit binnen één transactie; resolve met wat fn teruggeeft (na afronding)
    function tx(store, mode, fn) {
        return open().then(function (d) {
            return new Promise(function (resolve, reject) {
                var t = d.transaction(store, mode), out = fn(t.objectStore(store));
                t.oncomplete = function () { resolve(out); };
                t.onerror = function () { reject(t.error); };
                t.onabort = function () { reject(t.error || new Error('Transactie afgebroken')); };
            });
        });
    }

    function get(store, key) { return tx(store, 'readonly', function (s) { return s.get(key); }).then(function (r) { return r.result; }); }
    function put(store, key, val) { return tx(store, 'readwrite', function (s) { s.put(val, key); }); }
    function putMany(store, entries) {
        return tx(store, 'readwrite', function (s) { entries.forEach(function (e) { s.put(e[1], e[0]); }); });
    }
    // Alles uitlezen: { keys: [...], values: [...] }
    function all(store) {
        return tx(store, 'readonly', function (s) { return { k: s.getAllKeys(), v: s.getAll() }; })
            .then(function (r) { return { keys: r.k.result || [], values: r.v.result || [] }; });
    }
    function clear(store) { return tx(store, 'readwrite', function (s) { s.clear(); }); }
    function del(store, key) { return tx(store, 'readwrite', function (s) { s.delete(key); }); }

    // Gebruikte en beschikbare opslag (als de browser dat ondersteunt)
    function estimate() {
        if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate().catch(function () { return null; });
        return Promise.resolve(null);
    }

    return { get: get, put: put, putMany: putMany, all: all, clear: clear, del: del, estimate: estimate };
})();
