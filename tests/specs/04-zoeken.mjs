// Zoeken: eigen toetsenbord, tikfouten, personen (TMDB)
const rowItems = id => `(function () { var r = Screens.search.rows.rows.filter(function (r) { return r.id === '${id}'; })[0];
  return r ? r.list.items.map(function (x) { return (x.item || x).name; }) : []; })()`;

export default [
  {
    name: 'Zoeken met een tikfout vindt de film',
    async run(t) {
      await t.demo();
      await t.eval("App.section('search'); 1");
      await t.until('App.screen() === Screens.search');
      // In de demo delen sommige films een TMDB-id (die worden samengevoegd); Big Buck Bunny is uniek zichtbaar
      await t.type('bunyn');
      const names = await t.until(`${rowItems('movie')}.length && ${rowItems('movie')}`, 10000, 'geen films gevonden');
      t.eq(names[0], 'Big Buck Bunny', 'beste resultaat');
    }
  },
  {
    name: 'Zoektekst: letters, wissen en spatie',
    async run(t) {
      await t.demo();
      await t.eval("App.section('search'); 1");
      await t.until('App.screen() === Screens.search');
      // Zoals de toetsen van het schermtoetsenbord
      await t.eval("Screens.search.press('c'); Screens.search.press('l'); 1");
      t.eq(await t.eval('Screens.search.q'), 'cl', 'zoektekst');
      await t.eval("Screens.search.press('del'); Screens.search.press('space'); Screens.search.press('clear'); 1");
      t.eq(await t.eval('Screens.search.q'), '', 'wissen');
      await t.type('demoserie 3');
      await t.until(`${rowItems('series')}.indexOf('Demoserie 3') >= 0`, 10000, 'serie niet gevonden');
    }
  },
  {
    name: 'Zoekindex: afstand bij tikfouten',
    async run(t) {
      await t.demo();
      t.eq(await t.eval("[Find.dist('matirx', 'matrix', 2), Find.dist('sintel', 'sintel', 2), Find.dist('keanu', 'kenau', 2)]"), [1, 0, 1], 'afstanden');
    }
  },
  {
    name: 'Zoeken zonder speciale tekens (Turks, Pools, Duits)',
    async run(t) {
      await t.demo();
      t.eq(await t.eval("['Kırmızı Oda', 'Łódź Wieczorem', 'Straße', 'Søren', 'Ça Gaçe'].map(Find.words).map(function (w) { return w.join(' '); })"),
        ['kirmizi oda', 'lodz wieczorem', 'strasse', 'soren', 'ca gace'], 'genormaliseerde woorden');
    }
  },
  {
    name: 'Personen zoeken (TMDB)',
    tmdb: true,
    async run(t) {
      await t.demo();
      await t.eval("App.section('search'); 1");
      await t.until('App.screen() === Screens.search');
      await t.type('keanu reves');
      await t.until(`${rowItems('people')}.some(function (n) { return /Keanu Reeves/.test(n); })`, 15000, 'Keanu Reeves niet gevonden');
    }
  }
];
