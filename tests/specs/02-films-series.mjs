// Films- en Series-pagina's, detailpagina's en trailers
const btnIds = "Screens.movie.btns.map(function (b) { return b.id; })";

export default [
  {
    name: 'Films opent direct en vult daarna de rijen',
    async run(t) {
      await t.demo();
      // Eerste beeld moet er meteen zijn; het zware werk gebeurt daarna in stukjes
      const ms = await t.eval("(function () { var a = performance.now(); App.section('movie'); return performance.now() - a; })()");
      t.ok(ms < 300, `openen blokkeerde ${Math.round(ms)} ms`);
      await t.until('Screens.section.rows.rows.length >= 3', 10000, 'geen rijen op Films');
      t.ok(await t.eval("Screens.section.rows.rows.every(function (r) { return r.list.items.length > 0; })"), 'lege rij op Films');
    }
  },
  {
    name: 'Series opent en toont rijen',
    async run(t) {
      await t.demo();
      await t.eval("App.section('series'); 1");
      await t.until("Screens.section.mode === 'series' && Screens.section.rows.rows.length >= 2", 10000, 'geen rijen op Series');
    }
  },
  {
    name: 'Filmpagina: afspelen en Mijn lijst aan/uit',
    async run(t) {
      await t.demo();
      // Een film die nog niet in Mijn lijst staat
      await t.eval("Api.vodStreams(null).then(function (vs) { var m = vs.filter(function (x) { return !Store.isFav('movie', x.stream_id); })[0]; window.__free = m; App.go('movie', { item: m }); return 1; })");
      await t.until(`App.screen() === Screens.movie && ${btnIds}.indexOf('fav') >= 0`, 8000, 'knoppen ontbreken');
      const ids = await t.eval(btnIds);
      t.ok(ids.includes('start'), 'geen afspeelknop');
      await t.key('right', ids.indexOf('fav'));
      await t.key('ok');
      t.ok(await t.eval("Store.isFav('movie', window.__free.stream_id)"), 'niet toegevoegd aan Mijn lijst');
      await t.key('ok');
      t.ok(!(await t.eval("Store.isFav('movie', window.__free.stream_id)")), 'niet verwijderd uit Mijn lijst');
      await t.key('back');
      await t.until('App.screen() === Screens.home', 5000, 'Terug gaat niet naar Home');
    }
  },
  {
    name: 'Seriepagina: seizoenen en afleveringen',
    async run(t) {
      await t.demo();
      await t.eval("App.go('series', { item: window.__s }); 1");
      await t.until('App.screen() === Screens.series && Screens.series.seasons.items.length === 2 && Screens.series.eps.items.length > 0', 8000, 'geen seizoenen of afleveringen');
    }
  },
  {
    name: 'Trailer: in de browser in Kijkdoos zelf, op de TV in de YouTube-app',
    async run(t) {
      await t.demo();
      t.ok(await t.eval('App.canEmbed()'), 'via http moet de ingebouwde speler kunnen');
      // YouTube niet echt laden: alleen controleren waar de trailer naartoe gaat
      await t.eval("window.__app = []; App.trailerApp = function (k) { window.__app.push(k); }; var g = App.go; App.go = function (n, p) { if (n === 'trailer') { window.__emb = p.key; return; } return g.apply(App, arguments); }; 1");
      await t.eval("App.trailer('abc123', 'Test'); 1");
      t.eq(await t.eval('window.__emb'), 'abc123', 'trailer niet in Kijkdoos');
      await t.eval("Store.setSetting('trailer', 'youtube'); App.trailer('def456', 'Test'); 1");
      t.eq(await t.eval('window.__app'), ['def456'], 'instelling YouTube-app wordt genegeerd');
      // Op de TV (file://) kan de ingebouwde speler niet: altijd de YouTube-app
      await t.eval("Store.setSetting('trailer', 'app'); App.canEmbed = function () { return false; }; App.trailer('ghi789', 'Test'); 1");
      t.eq(await t.eval('window.__app'), ['def456', 'ghi789'], 'op de TV niet naar de YouTube-app');
    }
  },
  {
    name: 'Filmpagina met TMDB: trailer, beschrijving en cast',
    tmdb: true,
    async run(t) {
      await t.demo();
      await t.eval("App.go('movie', { item: window.__m }); 1");
      await t.until(`App.screen() === Screens.movie && ${btnIds}.indexOf('trailer') >= 0`, 15000, 'geen trailerknop (TMDB)');
      t.ok(await t.eval("Screens.movie.el.textContent.indexOf('Matrix') >= 0"), 'titel van TMDB ontbreekt');
    }
  }
];
