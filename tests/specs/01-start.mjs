// Opstarten, inloggen, Home en het menu bovenaan
export default [
  {
    name: 'Nieuwe installatie toont het inlogscherm',
    async run(t) {
      await t.open();
      await t.until('App.screen() === Screens.login', 5000, 'geen inlogscherm');
    }
  },
  {
    name: 'Inloggen met de demo-server gaat naar Home',
    async run(t) {
      await t.open();
      await t.until('App.screen() === Screens.login');
      await t.eval("Screens.login.fields.filter(function (f) { return f.key === 'server'; })[0].input.value = 'demo'; Screens.login.connect(); 1");
      await t.until('App.screen() === Screens.home', 10000, 'niet naar Home na inloggen');
      t.eq(await t.eval('Store.activeProfile().server'), 'demo', 'server van het actieve profiel');
    }
  },
  {
    name: 'Home toont Verder kijken, Mijn lijst, zenders en aanbevelingen',
    async run(t) {
      await t.demo();
      const ids = await t.until("Screens.home.rows.rows.length >= 5 && Screens.home.rows.rows.map(function (r) { return r.id; })", 10000, 'aanbevelingen komen niet');
      for (const id of ['hist', 'favs', 'chans']) t.ok(ids.includes(id), 'rij ontbreekt: ' + id);
      t.eq(await t.eval("Screens.home.rows.rows[0].list.items.length"), 3, 'items in Verder kijken');
      t.ok(await t.eval("Screens.home.heroBox.textContent.length > 0"), 'hero-blok is leeg');
    }
  },
  {
    name: 'Home: focus blijft staan als er rijen bijkomen of verdwijnen',
    async run(t) {
      await t.demo();
      await t.until('Screens.home.rows.rows.length >= 5', 10000, 'aanbevelingen komen niet');
      // Naar het tweede item van Mijn lijst
      const favRow = await t.eval("Screens.home.rows.rows.map(function (r) { return r.id; }).indexOf('favs')");
      await t.key('down', favRow);
      await t.key('right');
      const before = await t.eval('Screens.home.keyOf(Screens.home.rows.current())');
      t.eq(await t.eval('Screens.home.rows.rows[Screens.home.rows.cur].id'), 'favs', 'huidige rij');
      // Achtergrondgegevens wijzigen: aanbevelingen weg, nieuwe afleveringen erbij, daarna aanbevelingen terug
      await t.eval(`window.__renders = 0; var r0 = Screens.home.render; Screens.home.render = function () { window.__renders++; return r0.apply(this, arguments); };
        Follow.fresh = function () { return [{ id: '777', name: 'Test', icon: '', eps: [{ season: 1, episode: 2 }], at: 1 }]; };
        Reco.reset(); Screens.home.update(); Screens.home.updateReco(); 1`);
      await t.until("Screens.home.rows.rows.length >= 6", 10000, 'aanbevelingen komen niet terug');
      t.eq(await t.eval('Screens.home.keyOf(Screens.home.rows.current())'), before, 'focus verschoven naar ander item');
      t.eq(await t.eval('Screens.home.rows.rows[Screens.home.rows.cur].id'), 'favs', 'focus in andere rij');
      t.eq(await t.eval('window.__renders'), 0, 'Home is opnieuw opgebouwd');
      t.eq(await t.eval("Screens.home.rows.rows.filter(function (r) { return r.id === 'fresh'; }).length"), 1, 'rij Nieuwe afleveringen');
    }
  },
  {
    name: 'Menu bovenaan: elk onderdeel opent',
    async run(t) {
      await t.demo();
      const all = [['live', 'live'], ['movie', 'section'], ['series', 'section'], ['guide', 'guide'], ['mylist', 'mylist'],
        ['search', 'search'], ['settings', 'settings'], ['home', 'home']];
      for (const [id, screen] of all) {
        await t.eval(`App.section('${id}'); 1`);
        await t.until(`App.screen() === Screens.${screen}`, 5000, `${id} opent niet`);
        await t.wait(400);
      }
    }
  },
  {
    name: 'Menu bovenaan met de afstandsbediening: naar Films',
    async run(t) {
      await t.demo();
      await t.key('up', 8);
      t.ok(await t.eval('Screens.home.zone === "nav"'), 'menu krijgt geen focus');
      const at = await t.eval("Screens.home.nav.items.map(function (x) { return x.id; }).indexOf('movie') - Screens.home.nav.index");
      await t.key('right', at);
      await t.key('ok');
      await t.until("App.screen() === Screens.section && Screens.section.mode === 'movie'", 5000, 'Films opent niet');
      await t.key('back');
      await t.until('App.screen() === Screens.home', 5000, 'Terug gaat niet naar Home');
    }
  }
];
