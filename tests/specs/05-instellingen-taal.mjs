// Instellingen en taal (Engels standaard, Nederlands te kiezen)
const navText = "Screens.home.nav.itemEls.map(function (e) { return e.textContent; }).join('|')";

export default [
  {
    name: 'Instellingen tonen de belangrijkste rijen',
    async run(t) {
      await t.demo();
      await t.eval("App.section('settings'); 1");
      await t.until('App.screen() === Screens.settings', 5000);
      const ids = await t.eval("Screens.settings.list.items.map(function (r) { return r.id; })");
      for (const id of ['lang', 'profile', 'trailer', 'tmdb', 'refresh', 'about']) t.ok(ids.includes(id), 'rij ontbreekt: ' + id);
    }
  },
  {
    name: 'Standaard Engels, wisselen naar Nederlands en terug',
    async run(t) {
      await t.demo();
      t.eq(await t.eval('I18N.lang()'), 'en', 'standaardtaal');
      t.ok((await t.eval(navText)).includes('Movies'), 'menu niet in het Engels');
      // Taal wisselen herlaadt de app (zoals op de TV)
      await t.eval("Store.setSetting('lang', 'nl'); location.reload(); 1");
      await t.wait(500);
      await t.until("window.App && App.screen() === Screens.home && Screens.home.rows.rows.length > 0", 10000, 'Home komt niet terug na herladen');
      t.eq(await t.eval('I18N.lang()'), 'nl', 'taal na wisselen');
      const nl = await t.eval(navText);
      t.ok(nl.includes('Films') && nl.includes('Mijn lijst'), 'menu niet in het Nederlands: ' + nl);
      t.ok(await t.eval("Screens.home.rowsBox.textContent.indexOf('Verder kijken') >= 0"), 'Home niet in het Nederlands');
      await t.eval("Store.setSetting('lang', 'en'); location.reload(); 1");
      await t.wait(500);
      await t.until("window.App && App.screen() === Screens.home", 10000);
      t.ok((await t.eval(navText)).includes('Movies'), 'niet terug naar Engels');
    }
  },
  {
    name: 'Vertalingen met variabelen en datums',
    async run(t) {
      await t.demo();
      const s = await t.eval("T('Zenders ({n})', { n: 12 })");
      t.ok(s.includes('12') && !s.includes('{'), 'variabele niet ingevuld: ' + s);
      t.ok(!/Zenders/.test(s), 'niet vertaald: ' + s);
      t.eq(await t.eval('I18N.days().length'), 7, 'dagnamen');
      t.eq(await t.eval('I18N.months().length'), 12, 'maandnamen');
    }
  }
];
