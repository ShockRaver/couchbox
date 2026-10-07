// Live TV en de TV-gids
export default [
  {
    name: 'Live TV: categorieën en zenders',
    async run(t) {
      await t.demo();
      await t.eval("App.section('live'); 1");
      await t.until('App.screen() === Screens.live && Screens.live.cats.items.length > 2 && Screens.live.chans.items.length > 0', 8000, 'geen categorieën of zenders');
    }
  },
  {
    name: 'Gids: zenders met programma\'s',
    async run(t) {
      await t.demo();
      await t.eval("App.section('guide'); 1");
      await t.until("App.screen() === Screens.guide && Screens.guide.list.items.length > 0 && Screens.guide.el.querySelectorAll('.g-prog:not(.empty)').length > 1", 10000, 'gids blijft leeg');
      // Geen overlappende programma's binnen een zender
      const overlap = await t.eval(`Screens.guide.list.items.slice(0, 8).some(function (c) {
        var l = Screens.guide.progs(c) || [];
        return l.some(function (p, i) { return i && p.start < l[i - 1].end; });
      })`);
      t.ok(!overlap, 'overlappende programma\'s in de gids');
    }
  },
  {
    name: 'Gids: groep kiezen (alle zenders)',
    async run(t) {
      await t.demo();
      await t.eval("App.section('guide'); 1");
      await t.until("Screens.guide.items && Screens.guide.groupId === 'fav'", 10000, 'gids start niet met favorieten');
      // Omhoog naar de balk, OK op de groep, in het venster één omlaag naar "Alle zenders"
      await t.key('up');
      await t.key('ok');
      await t.until('Dialog.isOpen()', 3000, 'groepskeuze opent niet');
      await t.key('down');
      await t.key('ok');
      await t.until("Screens.guide.groupId === 'all' && Screens.guide.list.items.length > 20", 5000, 'niet naar alle zenders');
      await t.until("Screens.guide.el.querySelectorAll('.g-row').length > 5", 5000, 'rijen niet getekend');
    }
  },
  {
    name: 'Gids: door de tijd en naar Vanavond',
    async run(t) {
      await t.demo();
      await t.eval("App.section('guide'); 1");
      await t.until("Screens.guide.items && Screens.guide.progs(Screens.guide.list.current())", 10000, 'gids blijft leeg');
      const pi = await t.eval('Screens.guide.pi');
      await t.key('right', 2);
      t.ok(await t.eval('Screens.guide.pi') > pi, '▶ gaat niet naar het volgende programma');
      // Omhoog naar de balk, naar "Vanavond" en OK
      await t.key('up');
      t.eq(await t.eval('Screens.guide.zone'), 'bar', 'balk krijgt geen focus');
      await t.key('right', 2);
      await t.key('ok');
      const ok = await t.eval('Screens.guide.win <= Screens.guide.tonight() && Screens.guide.tonight() < Screens.guide.win + Screens.guide.WIN * 60000');
      t.ok(ok, 'Vanavond staat niet in beeld');
    }
  },
  {
    name: 'Herinnering zetten en weer weghalen',
    async run(t) {
      await t.demo();
      const r = await t.eval(`(function () {
        var ch = { stream_id: 1001, name: 'Test' }, p = { start: Date.now() + 3600e3, end: Date.now() + 7200e3, title: 'Later' };
        Remind.toggle(ch, p); var on = Remind.has(ch, p);
        Remind.toggle(ch, p); return [on, Remind.has(ch, p)];
      })()`);
      t.eq(r, [true, false], 'herinnering aan/uit');
    }
  }
];
