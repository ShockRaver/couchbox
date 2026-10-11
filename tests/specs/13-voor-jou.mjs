// "Voor jou" en beoordelen (vind ik leuk / niet voor mij)
export default [
  {
    name: 'Beoordelen op de filmpagina: leuk, niet voor mij, geen beoordeling',
    async run(t) {
      await t.demo();
      await t.eval("Api.vodStreams(null).then(function (l) { App.go('movie', { item: l[5] }); return 1; })");
      await t.until('App.screen() === Screens.movie && Screens.movie.btns');
      const i = await t.eval("Screens.movie.btns.findIndex(function (b) { return b.id === 'rate'; })");
      t.ok(i >= 0, 'knop Beoordelen ontbreekt');
      await t.eval(`Screens.movie.bi = ${i}; Screens.movie.onKey('ok'); 1`);
      await t.until('Dialog.isOpen()', 3000);
      // Het menu begint op de huidige keuze ("Geen beoordeling" = de derde)
      await t.key('up', 2); await t.key('ok');   // vind ik leuk
      t.eq(await t.eval("[Taste.get('m', Screens.movie.item), Screens.movie.btns[" + i + "].on]"), [1, true], 'leuk');
      await t.eval(`Screens.movie.onKey('ok'); 1`);
      await t.until('Dialog.isOpen()', 3000);
      await t.key('down'); await t.key('ok');   // van "leuk" naar "niet voor mij"
      t.eq(await t.eval("[Taste.get('m', Screens.movie.item), Screens.movie.btns[" + i + "].icon, Taste.list(-1).length]"), [-1, 'thumbdown', 1], 'niet voor mij');
      await t.eval(`Screens.movie.onKey('ok'); 1`);
      await t.until('Dialog.isOpen()', 3000);
      await t.key('down'); await t.key('ok');   // geen beoordeling
      t.eq(await t.eval("[Taste.get('m', Screens.movie.item), Taste.list().length]"), [0, 0], 'geen beoordeling');
    }
  },
  {
    name: 'Voor jou (zonder TMDB): genres van wat je leuk vindt eerst, "niet voor mij" nergens',
    async run(t) {
      await t.demo();
      const r = await t.eval(`(function () {
        CONFIG.tmdbKey = ''; Store.setSetting('tmdbKey', ''); Reco.reset();
        return Api.vodStreams(null).then(function (l) {
          var actie = l.filter(function (x) { return String(x.category_id) === '10'; });
          var other = l.filter(function (x) { return String(x.category_id) === '12'; });
          actie.slice(0, 4).forEach(function (x) { Taste.set('m', x, 1); });
          other.slice(0, 2).forEach(function (x) { Taste.set('m', x, -1); });
          var bad = other[0];
          return Reco.refresh('m').then(function (rows) {
            var fy = rows.filter(function (r) { return r.id === 'b:foryou'; })[0];
            var all = [].concat.apply([], rows.map(function (r) { return r.items; }));
            return {
              first: rows[0] && rows[0].id,
              top: fy ? fy.items.slice(0, 3).map(function (x) { return String(x.item.category_id); }) : null,
              bad: all.filter(function (x) { return String(x.item.stream_id) === String(bad.stream_id); }).length,
              rank: Rank.row('m', [bad].concat(actie.slice(4, 8)).map(function (x) { return Object.assign({}, x, { _r: 1 }); }), null, 10)
                .map(function (x) { return String(x.stream_id); }).indexOf(String(bad.stream_id))
            };
          });
        });
      })()`);
      t.eq(r.first, 'b:foryou', 'Voor jou is de eerste rij');
      t.eq(r.top, ['10', '10', '10'], 'genre van wat je leuk vindt bovenaan');
      t.eq(r.bad, 0, '"niet voor mij" toch aanbevolen');
      t.ok(r.rank > 0, '"niet voor mij" niet naar achteren in een genre-rij');
    }
  }
];
