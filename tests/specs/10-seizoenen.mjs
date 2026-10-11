// Seizoenscategorieën: Halloween, Kerst & Sinterklaas, Valentijn (rij vanaf 4 weken vóór de datum)
export default [
  {
    name: 'Seizoenen: wanneer welke rij verschijnt',
    async run(t) {
      await t.open();
      const r = await t.eval(`['2026-10-01', '2026-10-10', '2026-10-31T20:00', '2026-11-01T12:00', '2026-11-10', '2026-12-25T20:00', '2026-12-26T12:00', '2027-01-20', '2027-02-15T12:00']
        .map(function (d) { return d + ' ' + Season.active(new Date(d).getTime()).map(function (s) { return s.id; }).join(','); })`);
      t.eq(r, ['2026-10-01 ', '2026-10-10 halloween', '2026-10-31T20:00 halloween', '2026-11-01T12:00 ', '2026-11-10 kerst',
        '2026-12-25T20:00 kerst', '2026-12-26T12:00 ', '2027-01-20 valentijn', '2027-02-15T12:00 '], 'actieve seizoenen');
    }
  },
  {
    name: 'Seizoenen: titels via categorie en naam, zonder valse treffers',
    async run(t) {
      await t.demo();
      const r = await t.eval(`(function () {
        var cats = [{ category_id: '1', category_name: 'NL | Kerstfilms' }, { category_id: '2', category_name: 'Actie' }];
        var list = [
          { stream_id: 1, name: 'Gewone titel', category_id: '1' },        // in de kerstcategorie
          { stream_id: 2, name: 'A Christmas Story', category_id: '2' },
          { stream_id: 3, name: 'The Grinch', category_id: '2' },
          { stream_id: 4, name: 'Santa Clarita Diet', category_id: '2' },  // geen kerst
          { stream_id: 5, name: 'Halloween (1978)', category_id: '2' },
          { stream_id: 6, name: 'Sint Maarten', category_id: '2' }         // geen kerst
        ];
        var a = Api.vodCategories, g = Genres.all, e = Tmdb.enabled;
        Api.vodCategories = function () { return Promise.resolve(cats); };
        Genres.all = function () { return Promise.resolve(list); };
        Tmdb.enabled = function () { return false; };
        var ids = function (l) { return l.map(function (x) { return x.stream_id; }).sort(); };
        return Promise.all([Season.items('m', Season.byId('kerst')), Season.items('m', Season.byId('halloween'))]).then(function (r) {
          Api.vodCategories = a; Genres.all = g; Tmdb.enabled = e;
          return [ids(r[0]), ids(r[1])];
        });
      })()`);
      t.eq(r, [[1, 2, 3], [5]], 'kerst- en halloweentitels');
    }
  },
  {
    name: 'Seizoensrij op Films, direct na de persoonlijke rijen; seizoenen in het categorie-overzicht',
    async run(t) {
      await t.demo();
      await t.eval(`(function () {
        Season.active = function () { return [Season.byId('kerst')]; };
        Season.items = function () { return Api.vodStreams(null).then(function (l) { return l.slice(0, 6); }); };
        App.section('movie'); return 1;
      })()`);
      await t.until("Screens.section.rows.rows.some(function (r) { return r.id === 'season:kerst'; })", 8000, 'geen seizoensrij');
      const ids = await t.eval("Screens.section.rows.rows.map(function (r) { return r.id; })");
      const at = ids.indexOf('season:kerst'), personal = ids.filter(id => ['hist', 'fresh', 'favs'].includes(id)).length;
      t.eq(at, personal, 'plek van de seizoensrij: ' + ids.join(','));
      t.ok(!ids.includes('g:feest'), 'oud kerstgenre nog als rij');
      // Categorie-overzicht: seizoenen altijd zichtbaar
      await t.eval("App.go('catalog', { mode: 'movie' }); 1");
      await t.until("Screens.catalog.catList && Screens.catalog.catList.some(function (c) { return c.season === 'halloween'; })", 8000, 'seizoenen niet in het overzicht');
    }
  }
];
