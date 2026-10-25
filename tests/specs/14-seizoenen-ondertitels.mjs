// Seizoenen uit meerdere items van dezelfde serie samenvoegen; één ondertiteling automatisch aan
export default [
  {
    name: 'Serie: namen vergelijken en andere items van dezelfde serie vinden',
    async run(t) {
      await t.demo();
      t.eq(await t.eval("['NL | Breaking Bad S05 (2008) [HD]', 'EN: Breaking Bad', 'Breaking Bad - Seizoen 2', 'The Office (US)'].map(App.seriesKey)"),
        ['breakingbad', 'breakingbad', 'breakingbad', 'theoffice'], 'sleutels');
      const r = await t.eval(`(function () {
        var keep = [Api.series, Api.seriesCategories];
        Api.series = function () { return Promise.resolve([
          { series_id: 1, name: 'NL | Mijn Serie', category_id: '20', tmdb: '' },
          { series_id: 2, name: 'EN | Mijn Serie S04', category_id: '30', tmdb: '' },
          { series_id: 3, name: 'NL | Mijn Serie (1999)', category_id: '20', tmdb: '' },
          { series_id: 4, name: 'NL | Andere Serie', category_id: '20', tmdb: '555' },
          { series_id: 5, name: 'Totaal anders', category_id: '20', tmdb: '555' },
          { series_id: 6, name: 'NL | Mijn Serie', category_id: '20', tmdb: '777' }
        ]); };
        Api.seriesCategories = function () { return Promise.resolve([{ category_id: '20', category_name: 'NL | Drama' }, { category_id: '30', category_name: 'EN | Drama' }]); };
        return Promise.all([
          App.seriesSiblings({ series_id: 1, name: 'NL | Mijn Serie (2020)', category_id: '20' }),
          App.seriesSiblings({ series_id: 4, name: 'NL | Andere Serie', category_id: '20', tmdb: '555' })
        ]).then(function (x) {
          Api.series = keep[0]; Api.seriesCategories = keep[1];
          return x.map(function (l) { return l.map(function (s) { return s.item.series_id + (s.lang ? ':' + s.lang : ''); }); });
        });
      })()`);
      // 3 = ander jaartal, 6 = heeft een TMDB-id terwijl het origineel er geen heeft: wel op naam (zelfde naam, geen jaar)
      t.eq(r, [['6', '2:EN'], ['5']], 'gevonden items');
    }
  },
  {
    name: 'Serie: ontbrekende seizoenen en afleveringen aanvullen',
    async run(t) {
      await t.demo();
      const r = await t.eval(`(function () {
        var ep = function (s, e) { return { id: s + '0' + e, episode_num: e, title: 'E' + e, container_extension: 'mkv' }; };
        var a = App.parseSeries({ episodes: { 1: [ep(1, 1), ep(1, 2)], 2: [ep(2, 1)] } });
        var b = App.parseSeries({ episodes: { 2: [ep(2, 1), ep(2, 2)], 3: [ep(3, 1)], 0: [ep(0, 1)] } });
        var changed = App.mergeSeries(a, b, 'EN');
        return [changed, a.seasons.map(function (s) { return s.num + ':' + s.eps.length; }), a.seasons[2].name, a.flat.length, App.countSeasons(a), App.mergeSeries(a, b, 'EN')];
      })()`);
      t.eq(r[0], true, 'niets toegevoegd');
      t.eq(r[1], ['1:2', '2:2', '3:1', '0:1'], 'seizoenen (specials achteraan)');
      t.ok(/EN$/.test(r[2]), 'taal niet bij het seizoen: ' + r[2]);
      t.eq(r.slice(3), [6, 3, false], 'afleveringen, aantal seizoenen, tweede keer niets nieuws');
    }
  },
  {
    name: 'Ondertitels: automatisch aan als er precies één is (niet bij live)',
    async run(t) {
      await t.demo();
      const r = await t.eval(`(function () {
        var one = [{ index: 3, lang: 'en' }], two = [{ index: 3, lang: 'en' }, { index: 4, lang: 'nl' }];
        var f = function (x) { return x ? x.index : null; };
        return [f(Player.pickText(one, 'auto', false)), f(Player.pickText(one, 'auto', true)), f(Player.pickText(two, 'auto', false)),
          f(Player.pickText(one, 'off', false)), f(Player.pickText(two, 'nl', false)), f(Player.pickText(one, 'nl', false)), Store.settings().subLang];
      })()`);
      t.eq(r, [3, null, null, null, 4, null, 'auto'], 'keuzes en standaardinstelling');
    }
  }
];
