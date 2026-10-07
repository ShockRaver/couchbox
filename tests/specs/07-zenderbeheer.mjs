// Zenderbeheer: verbergen, volgorde, eigen zenderlijsten (Live TV, gids, zoeken, instellingen)
const catIds = "Screens.live.catList.map(function (c) { return c.id; })";

async function openLive(t) {
  await t.demo();
  await t.eval("App.section('live'); 1");
  await t.until('App.screen() === Screens.live && Screens.live.catList && Screens.live.chans.items.length > 0', 8000, 'Live TV laadt niet');
}

export default [
  {
    name: 'Zender verbergen via het optiemenu en weer tonen in Instellingen',
    async run(t) {
      await openLive(t);
      // Naar "Alle zenders", eerste zender, OK ingedrukt houden → "Zender verbergen"
      await t.eval("Screens.live.applyLineup('all'); Screens.live.setZone('chans'); 1");
      const first = await t.eval('Screens.live.chans.current().stream_id');
      const total = await t.eval('Screens.live.items.length');
      await t.eval('Screens.live.contextMenu(); 1');
      const at = await t.eval("Dialog.isOpen() && document.querySelectorAll('.dialog-item').length && [].map.call(document.querySelectorAll('.dialog-item .di-label'), function (e) { return e.textContent; }).indexOf(T('Zender verbergen'))");
      t.ok(at > 0, 'optie Zender verbergen ontbreekt');
      await t.key('down', at);
      await t.key('ok');
      t.eq(await t.eval('Screens.live.items.length'), total - 1, 'aantal zenders na verbergen');
      t.ok(await t.eval(`Screens.live.items.every(function (s) { return s.stream_id !== ${first}; })`), 'zender staat er nog');
      // Ook niet in de gids en niet in zoeken
      t.ok(await t.eval(`Lineup.load().then(function (L) { return L.all.every(function (s) { return s.stream_id !== ${first}; }); })`), 'zender nog in de gids-groepen');
      // Instellingen: weer tonen
      await t.eval("App.section('settings'); 1");
      await t.until('App.screen() === Screens.settings');
      t.ok(/1/.test(await t.eval("Screens.settings.list.items.filter(function (r) { return r.id === 'lineup'; })[0].value")), 'instelling toont geen verborgen zender');
      await t.eval('Screens.settings.lineupMenu(); 1');
      await t.until('Dialog.isOpen()', 3000);
      await t.key('ok');   // eerste regel: "Zender tonen: …"
      t.eq(await t.eval("(Store.getP('lineup', {}).hideCh || []).length"), 0, 'zender niet teruggezet');
    }
  },
  {
    name: 'Groep verbergen en groepen verplaatsen met ▲▼',
    async run(t) {
      await openLive(t);
      const before = await t.eval(catIds);
      const firstCat = before.find(id => id.startsWith('c:'));
      const second = before.filter(id => id.startsWith('c:'))[1];
      // Tweede categorie omhoog verplaatsen
      await t.eval(`Screens.live.setZone('cats'); Screens.live.cats.focus(${before.indexOf(second)}); Screens.live.startMove('cat'); 1`);
      await t.key('up');
      await t.key('ok');
      const after = await t.eval(catIds);
      t.ok(after.indexOf(second) < after.indexOf(firstCat), 'groep niet verplaatst: ' + after.join(','));
      // Na herladen nog steeds zo
      t.ok(await t.eval(`Lineup.load().then(function (L) { var ids = L.groups.map(function (g) { return g.id; }); return ids.indexOf('${second}') < ids.indexOf('${firstCat}'); })`), 'volgorde niet bewaard');
      // Groep verbergen
      await t.eval(`Lineup.hideCat('${firstCat.slice(2)}', true); Screens.live.applyLineup('all'); 1`);
      t.ok(!(await t.eval(catIds)).includes(firstCat), 'groep niet verborgen');
      // Verplaatsen kan niet tussen soorten (categorie niet boven Favorieten)
      await t.eval(`Screens.live.setZone('cats'); Screens.live.cats.focus(Screens.live.catList.findIndex(function (c) { return c.kind === 'cat'; })); Screens.live.startMove('cat'); 1`);
      await t.key('up', 5);
      await t.key('ok');
      t.eq((await t.eval(catIds)).slice(0, 2), ['all', 'fav'], 'categorie boven Alle zenders/Favorieten gezet');
    }
  },
  {
    name: 'Eigen zenderlijst: maken, vullen, volgorde, in de gids',
    async run(t) {
      await openLive(t);
      await t.eval(`var l = Lineup.addList('Sport'); window.__l = l.id;
        Screens.live.all.slice(0, 3).forEach(function (s) { Lineup.toggleInList(l.id, s); });
        Screens.live.applyLineup('l:' + l.id); 1`);
      t.eq(await t.eval("Screens.live.cat.name"), 'Sport', 'lijst niet geopend');
      const ids = await t.eval('Screens.live.items.map(function (s) { return s.stream_id; })');
      t.eq(ids.length, 3, 'zenders in de lijst');
      // Laatste zender naar boven verplaatsen
      await t.eval("Screens.live.setZone('chans'); Screens.live.chans.focus(2); Screens.live.startMove('ch'); 1");
      await t.key('up', 2);
      await t.key('ok');
      t.eq(await t.eval('Screens.live.items.map(function (s) { return s.stream_id; })'), [ids[2], ids[0], ids[1]], 'volgorde in de lijst');
      // In de gids als groep
      await t.eval("App.section('guide'); 1");
      await t.until("Screens.guide.groups && Screens.guide.groups.some(function (g) { return g.name === 'Sport' && g.n === 3; })", 8000, 'lijst niet in de gids');
      // Lijst verwijderen
      await t.eval('Lineup.deleteList(window.__l); 1');
      t.eq(await t.eval('Lineup.lists().length'), 0, 'lijst niet verwijderd');
    }
  },
  {
    name: 'Favorieten verplaatsen',
    async run(t) {
      await openLive(t);
      await t.eval(`Screens.live.all.slice(1, 3).forEach(function (s) { if (!Store.isFav('live', s.stream_id)) Store.toggleFav('live', App.favFromCh(s)); });
        Screens.live.applyLineup('fav'); Screens.live.setZone('chans'); 1`);
      const ids = await t.eval('Screens.live.items.map(function (s) { return s.stream_id; })');
      t.ok(ids.length >= 3, 'te weinig favorieten');
      await t.eval("Screens.live.chans.focus(0); Screens.live.startMove('ch'); 1");
      await t.key('down');
      await t.key('ok');
      t.eq(await t.eval("Store.favorites('live').map(function (f) { return +f.id; }).slice(0, 2)"), [ids[1], ids[0]], 'volgorde favorieten');
    }
  }
];
