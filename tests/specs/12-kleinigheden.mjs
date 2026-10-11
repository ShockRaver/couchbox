// Kleinere functies: "Bedoelde je …?", zenders A-Z, Top 10-rij, volgende aflevering in de aftiteling, categorieën op slot
async function openLive(t) {
  await t.demo();
  await t.eval("App.section('live'); 1");
  await t.until('App.screen() === Screens.live && Screens.live.catList && Screens.live.chans.items.length > 0', 8000, 'Live TV laadt niet');
}

export default [
  {
    name: 'Zoeken: "Bedoelde je …?" bij een tikfout',
    async run(t) {
      await t.demo();
      await t.eval("App.section('search'); 1");
      await t.until('App.screen() === Screens.search && Find.ready()', 10000, 'zoekindex niet klaar');
      // (In de demo zijn Elephants Dream en Sintel samengevoegd met andere titels: zelfde TMDB-id)
      t.eq(await t.eval("[Find.suggest('big bukc bunyy'), Find.suggest('demofilmm'), Find.suggest('bun'), Find.suggest('bunny'), Find.suggest('qqqqqqq')]"),
        ['big buck bunny', 'demofilm', null, null, null], 'suggesties');
      await t.type('big bukc bunyy');
      await t.until("/Bedoelde je|Did you mean/i.test(Screens.search.recentBox.textContent) && /big buck bunny/.test(Screens.search.recentBox.textContent)", 5000, 'suggestie niet getoond');
      // Omlaag naar de suggestie en OK: zoekt op de verbeterde tekst
      await t.eval("Screens.search.ri = 0; Screens.search.setZone('recent'); Screens.search.onKey('ok'); 1");
      t.eq(await t.eval('Screens.search.q'), 'big buck bunny', 'zoektekst na kiezen');
    }
  },
  {
    name: 'Zenders A-Z en terug op nummer',
    async run(t) {
      await openLive(t);
      const names = await t.eval("Lineup.setSort('az'); Screens.live.applyLineup('all'); Screens.live.items.map(function (s) { return s.name; })");
      const sorted = names.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      t.eq(names, sorted, 'A-Z');
      t.ok(names.indexOf('Algemeen 5') < names.indexOf('Algemeen 10'), 'cijfers op waarde');
      const nums = await t.eval("Lineup.setSort('num'); Screens.live.applyLineup('all'); Screens.live.items.slice(0, 5).map(function (s) { return s.num; })");
      t.eq(nums, [1, 2, 3, 4, 5], 'op nummer');
    }
  },
  {
    name: 'Top 10-rij: groot cijfer bij elke poster',
    async run(t) {
      await t.demo();
      const r = await t.eval(`Api.vodStreams(null).then(function (l) {
        var row = UI.recoRow({ id: 'top10', rank: true, title: 'Top 10', items: l.slice(0, 10).map(function (it) { return { type: 'm', item: it }; }) });
        return [row.itemW, row.render(row.items[0], 0).querySelector('.rank-num').textContent, row.render(row.items[9], 9).className];
      })`);
      t.eq(r, [290, '1', 'rank-card ten'], 'Top 10-kaart');
    }
  },
  {
    name: 'Volgende aflevering: in de laatste 20 seconden al aangeboden',
    async run(t) {
      await t.demo();
      const r = await t.eval(`(function () {
        var out = [], keep = [Player.duration, Player.time, Player.state];
        Player.duration = function () { return 1200000; }; Player.time = function () { return 1185000; }; Player.state = function () { return 'playing'; };
        var fake = { mode: 'episode', overlay: null, item: { id: '1' }, seekTarget: null, nextEpisode: function () { return { id: '2' }; },
          askNext: function (n, auto, secs, early) { out.push([auto, secs, early]); } };
        Store.setSetting('autoNext', 'on');
        Screens.player.checkUpNext.call(fake);
        Screens.player.checkUpNext.call(fake);       // niet nog een keer voor dezelfde aflevering
        fake.upNextFor = null; Store.setSetting('autoNext', 'ask');
        Screens.player.checkUpNext.call(fake);       // bij "vragen": pas aan het eind
        Player.duration = keep[0]; Player.time = keep[1]; Player.state = keep[2];
        return out;
      })()`);
      t.eq(r, [[true, 15, true]], 'aanbieden');
    }
  },
  {
    name: 'Kinderslot: zendergroep op slot, ontgrendelen met de pincode',
    async run(t) {
      await openLive(t);
      const total = await t.eval("Store.setSetting('pin', '1234'); App.setLock('live', '2', true); App.relock(); Screens.live.applyLineup('c:2'); Screens.live.all.length");
      t.eq(await t.eval('[Screens.live.cat.locked, Screens.live.items.length]'), [true, 0], 'groep op slot');
      t.ok(await t.eval("Screens.live.all.every(function (s) { return String(s.category_id) !== '2'; })"), 'zenders van de groep staan in Alle zenders');
      // OK op de groep: pincode (eerst fout, dan goed)
      await t.eval("Screens.live.setZone('cats'); Screens.live.onKey('ok'); ['1', '1', '1', '1'].forEach(function (k) { Dialog.onKey(k); }); 1");
      t.eq(await t.eval('[App.isUnlocked(), Screens.live.items.length]'), [false, 0], 'foute pincode');
      await t.eval("Screens.live.onKey('ok'); ['1', '2', '3', '4'].forEach(function (k) { Dialog.onKey(k); }); 1");
      t.ok(await t.eval('App.isUnlocked() && Screens.live.items.length > 0'), 'niet ontgrendeld');
      t.ok(await t.eval('Screens.live.all.length') > total, 'Alle zenders niet aangevuld na ontgrendelen');
      // Weer op slot als de app naar de achtergrond gaat
      t.eq(await t.eval("App.relock(); Screens.live.applyLineup('c:2'); Screens.live.items.length"), 0, 'weer op slot');
    }
  },
  {
    name: 'Kinderslot: filmcategorie op slot telt niet mee in genres en zoeken; 18+ op slot',
    async run(t) {
      await t.demo();
      const r = await t.eval(`Api.vodCategories().then(function (cats) {
        Store.setSetting('pin', '1234');
        var count = function () { return Genres.all('m', cats).then(function (l) { return l.filter(function (x) { return String(x.category_id) === '10'; }).length; }); };
        return count().then(function (before) {
          App.setLock('movie', '10', true); App.relock();
          return count().then(function (locked) {
            App.unlockedAt = Date.now();
            return count().then(function (open) { return [before > 0, locked, open === before]; });
          });
        });
      })`);
      t.eq(r, [true, 0, true], 'genres: voor, op slot, ontgrendeld');
      const a = await t.eval(`(function () {
        var cats = [{ category_id: '9', category_name: 'XXX | For Adults' }, { category_id: '8', category_name: 'Kids' }];
        App.relock();
        Store.setSetting('hideAdult', 'lock'); var lock = [App.adultIds(cats), App.lockIds('live', cats), App.blockedIds('live', cats)];
        Store.setSetting('hideAdult', true); var hide = [App.adultIds(cats), App.lockIds('live', cats)];
        Store.setSetting('pin', ''); Store.setSetting('hideAdult', 'lock'); var nopin = App.blockedIds('live', cats);
        return [lock, hide, nopin];
      })()`);
      t.eq(a, [[null, { 9: true }, { 9: true }], [{ 9: true }, null], null], '18+ verbergen of op slot (zonder pincode geen slot)');
    }
  }
];
