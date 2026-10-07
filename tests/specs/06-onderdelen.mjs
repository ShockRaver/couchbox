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
