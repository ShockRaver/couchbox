// Losse onderdelen, getest in de pagina zelf (zonder schermen)
export default [
  {
    name: 'Gids: overlappende en dubbele programma\'s worden opgeruimd',
    async run(t) {
      await t.demo();
      const r = await t.eval(`(function () {
        var m = 60e3, l = EPG.clean([
          { start: 0, end: 60 * m, title: 'A' },
          { start: 0, end: 30 * m, title: 'A kort (dubbel)' },
          { start: 10 * m, end: 50 * m, title: 'Binnen A' },
          { start: 45 * m, end: 90 * m, title: 'B (begint voor einde A)' },
          { start: 45 * m + 30e3, end: 95 * m, title: 'B bijna dubbel' },
          { start: 90 * m, end: 120 * m, title: 'C' }
        ]);
        return l.map(function (p) { return p.title + '@' + p.start / m + '-' + p.end / m; });
      })()`);
      t.eq(r, ['A@0-45', 'B (begint voor einde A)@45-90', 'C@90-120'], 'opgeruimde lijst');
    }
  },
  {
    name: 'Aanbevelingen bevatten alleen titels uit de eigen bibliotheek',
    async run(t) {
      await t.demo();
      const r = await t.eval(`Promise.all([Api.vodStreams(null), Api.series(null), Reco.refresh('home')]).then(function (x) {
        var ids = {};
        x[0].forEach(function (v) { ids['m' + v.stream_id] = 1; });
        x[1].forEach(function (s) { ids['t' + s.series_id] = 1; });
        var items = [].concat.apply([], x[2].map(function (r) { return r.items; }));
        return { rows: x[2].length, items: items.length, foreign: items.filter(function (i) { return !ids[i.type + (i.type === 'm' ? i.item.stream_id : i.item.series_id)]; }).length };
      })`);
      t.ok(r.rows > 0 && r.items > 0, 'geen aanbevelingen: ' + JSON.stringify(r));
      t.eq(r.foreign, 0, 'titels buiten de bibliotheek');
    }
  },
  {
    name: 'Volgorde in genre-rijen: recent en goed gewaardeerd eerst',
    async run(t) {
      await t.demo();
      // Zonder TMDB-id: jaartal uit de naam en waardering van de provider
      const r = await t.eval(`(function () {
        var y = new Date().getFullYear(), now = Math.floor(Date.now() / 1000);
        var l = [
          { stream_id: 1, name: 'Oud en matig (1984)', rating: '6.0', added: String(now) },
          { stream_id: 2, name: 'Nieuw en goed (' + (y - 1) + ')', rating: '8.0', added: String(now - 86400 * 300) },
          { stream_id: 3, name: 'Nieuw en slecht (' + y + ')', rating: '3.5', added: String(now - 86400 * 300) },
          { stream_id: 4, name: 'Klassieker (1994)', rating: '9.0', added: String(now - 86400 * 300) }
        ];
        return Rank.sort('m', l).map(function (x) { return x.stream_id; });
      })()`);
      t.eq(r[0], 2, 'recent en goed gewaardeerd niet bovenaan: ' + r);
      t.ok(r.indexOf(1) > r.indexOf(2) && r.indexOf(1) > r.indexOf(3), 'oude, net toegevoegde film staat te hoog: ' + r);
      t.eq(await t.eval("[Rank.yearOf('m', { name: 'NL | Film (2019) [4K]' }), Rank.yearOf('m', { name: 'Blade Runner 2049' }), Rank.yearOf('m', { name: 'Zonder jaar' })]"), [2019, 2049 > new Date().getFullYear() + 2 ? 0 : 2049, 0], 'jaartal uit de naam');
    }
  },
  {
    name: 'Genre-rijen: niet dezelfde titels vooraan, gekeken titels naar achteren',
    async run(t) {
      await t.demo();
      const r = await t.eval(`(function () {
        var y = new Date().getFullYear(), l = [];
        for (var i = 1; i <= 30; i++) l.push({ stream_id: 7000 + i, name: 'Titel ' + i + ' (' + (y - i) + ')', rating: '7.0', added: '1' });
        var ranked = Rank.sort('m', l), used = {};
        var a = Rank.row('m', ranked, used, 20), b = Rank.row('m', ranked, used, 20);
        var ids = function (x) { return x.map(function (it) { return it.stream_id; }); };
        var overlap = ids(a).slice(0, Rank.TOP).filter(function (id) { return ids(b).slice(0, Rank.TOP).indexOf(id) >= 0; });
        // De beste titel als gekeken markeren: zakt naar achteren
        var best = ids(Rank.row('m', ranked, null, 30))[0];
        Store.saveProgress({ key: 'movie:' + best, mode: 'movie', id: String(best), name: 'x', icon: '', ext: 'mp4', position: 50, duration: 100 });
        var after = ids(Rank.row('m', ranked, null, 30));
        return { overlap: overlap.length, laterInB: ids(b).slice(Rank.TOP).length, bestBefore: 0, bestAfter: after.indexOf(best) };
      })()`);
      t.eq(r.overlap, 0, 'zelfde titels vooraan in twee rijen');
      t.ok(r.laterInB > 0, 'titels uit de eerste rij mogen verderop wel terugkomen');
      t.ok(r.bestAfter >= 5, 'gekeken titel blijft vooraan staan (plek ' + r.bestAfter + ')');
    }
  },
  {
    name: 'Nieuw toegevoegd: oude films naar achteren',
    async run(t) {
      await t.demo();
      const r = await t.eval(`(function () {
        var y = new Date().getFullYear();
        var l = [{ stream_id: 1, name: 'Oud (1979)' }, { stream_id: 2, name: 'Recent (' + (y - 2) + ')' }, { stream_id: 3, name: 'Ook oud (1990)' }, { stream_id: 4, name: 'Onbekend jaar' }];
        return Rank.recent('m', l, null, 10).map(function (x) { return x.stream_id; });
      })()`);
      t.eq(r, [2, 4, 1, 3], 'volgorde');
    }
  },
  {
    name: 'Kwaliteitslabels (4K/HDR) uit de naam',
    async run(t) {
      await t.demo();
      const r = await t.eval("['Film 4K HDR', 'Zender UHD', 'Serie (2160p) DV', 'Gewone film', 'Hdrama'].map(function (n) { return UI.quality(n).join(','); })");
      t.eq(r, ['4K,HDR', '4K', '4K', '', ''], 'labels');
    }
  },
  {
    name: 'Versie-informatie aanwezig',
    async run(t) {
      await t.demo();
      t.ok(await t.eval("typeof BUILD === 'object' && typeof App.VERSION === 'string' && App.VERSION.length > 0"), 'geen versie');
    }
  }
];
