// TMDB-voorwaarden: naamsvermelding met logo, en gegevens niet langer dan 150 dagen bewaren (TMDB staat 6 maanden toe)
export default [
  {
    name: 'TMDB: logo en vaste tekst in "Over deze app"',
    async run(t) {
      await t.demo();
      await t.eval("App.section('settings'); 1");
      await t.until('App.screen() === Screens.settings');
      await t.eval("Screens.settings.action('about'); 1");
      await t.until('Dialog.isOpen()', 3000);
      const r = await t.eval(`(function () {
        var img = document.querySelector('.dialog .tmdb-logo'), p = document.querySelector('.dialog .tmdb-credit p');
        return [!!img && /img\\/tmdb\\.svg$/.test(img.getAttribute('src')), img ? img.naturalWidth > 0 || img.complete : false, p ? p.textContent : ''];
      })()`);
      t.ok(r[0], 'geen TMDB-logo in de dialoog');
      t.ok(/uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB/.test(r[2]), 'tekst: ' + r[2]);
    }
  },
  {
    name: 'TMDB: gegevens ouder dan 150 dagen worden verwijderd en opnieuw opgezocht',
    async run(t) {
      await t.demo();
      const r = await t.eval(`(function () {
        var day = Math.floor(Date.now() / 864e5), keep = Meta.KEEP_DAYS;
        var rec = function (at) { return ['Titel', 'Titel', 2020, 90, 70, 100, 10, 'en', 'US', '', '', 0, '', 'en', at]; };
        var old = Date.now() - (keep + 10) * 864e5, fresh = Date.now() - 5 * 864e5;
        Store.setGlobal('season.halloween.m', { at: old, ids: ['1'] });
        Store.setGlobal('season.kerst.m', { at: fresh, ids: ['2'] });
        return Promise.all([
          Db.putMany('titles', [['m:9991', rec(day - keep - 1)], ['m:9992', rec(day - 3)]]),
          Db.putMany('details', [['m:9991', { v: 2, at: old }], ['m:9992', { v: 2, at: fresh }]])
        ]).then(function () { return Meta.reload(); }).then(function () {
          Meta.retention();
          return new Promise(function (r) { setTimeout(r, 300); });
        }).then(function () {
          return Promise.all([Db.get('titles', 'm:9991'), Db.get('details', 'm:9991'), Db.get('details', 'm:9992')]);
        }).then(function (x) {
          return [Meta.has('m', '9991'), Meta.has('m', '9992'), !!x[0], !!x[1], !!x[2],
            !!Store.getGlobal('season.halloween.m', null), !!Store.getGlobal('season.kerst.m', null),
            Meta.fromTmdb('m', { title: 'X' })[14] === day];
        });
      })()`);
      t.eq(r, [false, true, false, false, true, false, true, true], 'oud weg, nieuw blijft, nieuwe records krijgen een datum');
    }
  }
];
