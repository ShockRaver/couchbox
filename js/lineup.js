/* Zenderindeling per profiel: verborgen groepen en zenders, eigen volgorde van groepen, eigen zenderlijsten.
   Live TV, de TV-gids en zoeken halen hun groepen en zenders hier vandaan, zodat het overal hetzelfde is.
   Groep-id's: 'all' (alle zenders), 'fav' (favorieten), 'l:<id>' (eigen lijst), 'c:<categorie-id>' (categorie van de provider). */
var Lineup = (function () {
    'use strict';

    function data() {
        var d = Store.getP('lineup', null) || {};
        return { hideCats: d.hideCats || [], hideCh: d.hideCh || [], order: d.order || [], lists: d.lists || [], sort: d.sort || 'num' };
    }
    function save(d) { Store.setP('lineup', d); }
    function setIn(arr, id, on) {
        id = String(id);
        var i = arr.indexOf(id);
        if (on && i < 0) arr.push(id);
        if (!on && i >= 0) arr.splice(i, 1);
    }
    function map(arr) { var m = {}; arr.forEach(function (x) { m[x] = 1; }); return m; }

    // Verborgen? Zender zelf verborgen, of al zijn groepen verborgen
    function hiddenFn(d) {
        var hc = map(d.hideCats), hs = map(d.hideCh);
        return function (s) {
            if (hs[String(s.stream_id)]) return true;
            var ids = App.catIds(s);
            return ids.length > 0 && ids.every(function (id) { return hc[id]; });
        };
    }
    // Zenders zonder verborgen zenders/groepen (bv. voor zoeken)
    function visible(list) { var h = hiddenFn(data()); return list.filter(function (s) { return !h(s); }); }

    // Alles opbouwen uit de categorieën en zenders van de provider (zonder 18+)
    function build(cats, streams) {
        var d = data(), adult = App.adultIds(cats), hidden = hiddenFn(d), hideCh = map(d.hideCh);
        // Op slot (kinderslot): de groep blijft zichtbaar met een slotje, de zenders pas na de pincode
        var locks = App.lockIds('live', cats), shut = App.isUnlocked() ? null : locks;
        var full = {}, byId = {}, count = {}, all = [];
        streams.forEach(function (s) {
            if (adult && App.inCats(s, adult)) return;
            full[s.stream_id] = s;
            if (hidden(s)) return;
            App.catIds(s).forEach(function (id) { count[id] = (count[id] || 0) + 1; });
            if (shut && App.inCats(s, shut)) return;
            all.push(s);
            byId[s.stream_id] = s;
        });
        // A-Z (alle zenders en de categorieën; favorieten en eigen lijsten houden hun eigen volgorde)
        if (d.sort === 'az') all.sort(function (a, b) { return azCmp(a.name, b.name); });
        // Favorieten en eigen lijsten tonen hun zenders ook als de groep verborgen is (wel niet als de zender zelf verborgen is)
        var pickFrom = function (favs) {
            return favs.filter(function (f) { return !hideCh[String(f.id)]; }).map(function (f) { return full[f.id] || App.chFromFav(f); });
        };
        var groups = [{ id: 'all', kind: 'all', name: T('Alle zenders'), n: all.length, items: function () { return all; } }];
        var favs = pickFrom(Store.favorites('live'));
        groups.push({ id: 'fav', kind: 'fav', name: T('Favorieten'), n: favs.length, items: function () { return favs; } });
        d.lists.forEach(function (l) {
            var items = pickFrom(l.items || []);
            groups.push({ id: 'l:' + l.id, kind: 'list', listId: l.id, name: l.name, n: items.length, items: function () { return items; } });
        });
        // Categorieën: eigen volgorde eerst, daarna de rest in de volgorde van de provider
        var pos = map([]);
        d.order.forEach(function (id, i) { pos[id] = i + 1; });
        var hc = map(d.hideCats);
        cats.map(function (c, i) { return { c: c, i: i, p: pos[String(c.category_id)] || 1e6 + i }; })
            .sort(function (a, b) { return a.p - b.p; })
            .forEach(function (x) {
                var id = String(x.c.category_id);
                if ((adult && adult[id]) || hc[id] || !count[id]) return;
                var lockedNow = !!(shut && shut[id]);
                groups.push({
                    id: 'c:' + id, kind: 'cat', catId: id, name: x.c.category_name, n: count[id], lock: !!(locks && locks[id]), locked: lockedNow,
                    items: function () { return lockedNow ? [] : all.filter(function (s) { return App.catIds(s).indexOf(id) >= 0; }); }
                });
            });
        // Verborgen groepen en zenders (voor Instellingen)
        var catName = {};
        cats.forEach(function (c) { catName[String(c.category_id)] = c.category_name; });
        return {
            all: all, byId: byId, full: full, groups: groups,
            hiddenCats: d.hideCats.filter(function (id) { return catName[id]; }).map(function (id) { return { id: id, name: catName[id] }; }),
            hiddenChannels: d.hideCh.map(function (id) { return full[id] || { stream_id: id, name: T('Zender {num}', { num: id }) }; })
        };
    }
    function load() {
        return Promise.all([Api.liveCategories(), Api.liveStreams()]).then(function (r) { var L = build(r[0], r[1]); L.cats = r[0]; L.streams = r[1]; return L; });
    }

    // Alfabetisch zonder landvoorvoegsel ("NL | ", "UK: "), cijfers op waarde ("NPO 2" voor "NPO 10")
    function azKey(n) { return String(n || '').replace(/^\s*[|#]?[A-Za-z]{2,4}\s*(?:[|:]|\s-\s)\s*/, '').trim(); }
    function azCmp(a, b) { return azKey(a).localeCompare(azKey(b), undefined, { numeric: true, sensitivity: 'base' }); }

    // ---- Wijzigen ----
    function sortMode() { return data().sort; }
    function setSort(m) { var d = data(); d.sort = m; save(d); }
    function hideCat(id, on) { var d = data(); setIn(d.hideCats, id, on); save(d); }
    function hideChannel(id, on) { var d = data(); setIn(d.hideCh, id, on); save(d); }
    function showAll() { var d = data(); d.hideCats = []; d.hideCh = []; save(d); }
    // Volgorde van de categorieën (id's zonder 'c:')
    function setOrder(ids) { var d = data(); d.order = ids.map(String); save(d); }
    function resetOrder() { var d = data(); d.order = []; save(d); }
    function hasCustom() { var d = data(); return d.hideCats.length + d.hideCh.length + d.order.length > 0; }

    // Eigen lijsten: { id, name, items: [zender zoals bij favorieten] }
    function lists() { return data().lists; }
    function addList(name) {
        var d = data(), l = { id: U.uid(), name: name, items: [] };
        d.lists.push(l); save(d);
        return l;
    }
    function editList(id, fn) {
        var d = data(), l = d.lists.filter(function (x) { return x.id === id; })[0];
        if (l) { fn(l, d); save(d); }
        return l;
    }
    function renameList(id, name) { editList(id, function (l) { l.name = name; }); }
    function deleteList(id) { var d = data(); d.lists = d.lists.filter(function (x) { return x.id !== id; }); save(d); }
    function inList(id, chId) { var l = data().lists.filter(function (x) { return x.id === id; })[0]; return !!(l && l.items.some(function (f) { return String(f.id) === String(chId); })); }
    // Zender in een lijst zetten of eruit halen; true = toegevoegd
    function toggleInList(id, ch) {
        var added = false;
        editList(id, function (l) {
            var i = l.items.findIndex(function (f) { return String(f.id) === String(ch.stream_id); });
            if (i >= 0) l.items.splice(i, 1); else { l.items.push(App.favFromCh(ch)); added = true; }
        });
        return added;
    }
    // Volgorde van de zenders in een lijst of in de favorieten (ids in de nieuwe volgorde)
    function reorder(groupId, ids) {
        var pos = {};
        ids.forEach(function (id, i) { pos[String(id)] = i; });
        var sort = function (items) { return items.slice().sort(function (a, b) { return (pos[String(a.id)] != null ? pos[String(a.id)] : 1e6) - (pos[String(b.id)] != null ? pos[String(b.id)] : 1e6); }); };
        if (groupId === 'fav') Store.setFavorites('live', sort(Store.favorites('live')));
        else editList(groupId.slice(2), function (l) { l.items = sort(l.items); });
    }
    // Volgorde van de eigen lijsten
    function orderLists(ids) {
        var d = data();
        d.lists.sort(function (a, b) { return ids.indexOf('l:' + a.id) - ids.indexOf('l:' + b.id); });
        save(d);
    }

    return {
        build: build, load: load, visible: visible, sortMode: sortMode, setSort: setSort,
        hideCat: hideCat, hideChannel: hideChannel, showAll: showAll, setOrder: setOrder, resetOrder: resetOrder, hasCustom: hasCustom,
        lists: lists, addList: addList, renameList: renameList, deleteList: deleteList, inList: inList, toggleInList: toggleInList,
        reorder: reorder, orderLists: orderLists
    };
})();
