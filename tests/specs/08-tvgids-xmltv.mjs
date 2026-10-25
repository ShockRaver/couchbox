// Tv-gids uit XMLTV (demo: nagemaakte gids van de provider) en de instelling "Volgende aflevering afspelen"
async function withXmltv(t) {
  await t.demo();
  const m = await t.eval("Xmltv.setSource({ mode: 'xmltv' }); Xmltv.refresh(true).then(function (m) { return { matched: m.matched, total: m.total, kept: m.kept }; })");
  return m;
}

export default [
  {
    name: 'XMLTV: gids inlezen en zenders koppelen (epg-id én naam)',
    async run(t) {
      const m = await withXmltv(t);
      // Demo: 60 zenders, 6 ontbreken in de gids (9, 19, …), de rest op epg-id of op naam (ook met "HD" erachter)
      t.eq([m.matched, m.total], [54, 60], 'gekoppelde zenders');
      const r = await t.eval(`Promise.all([1002, 1003, 1007, 1009].map(function (id) { return Xmltv.list(id).then(function (l) { return l ? l.length : 0; }); }))`);
      t.ok(r[0] > 10 && r[1] > 10 && r[2] > 10, 'geen programma\'s voor gekoppelde zenders: ' + r);
      t.eq(r[3], 0, 'zender 9 hoort niet in de gids');
      t.ok(/54/.test(await t.eval('Xmltv.status()')), 'status toont aantal zenders niet');
    }
  },
  {
    name: 'XMLTV: gids gebruikt XMLTV, zenders zonder gegevens de provider',
    async run(t) {
      await withXmltv(t);
      const titles = await t.eval(`Promise.all([1002, 1009].map(function (id) { return new Promise(function (r) { EPG.request(id, EPG.FULL, function (l) { r(l.map(function (p) { return p.title; })); }); }); }))`);
      const xs = await t.eval('Demo.XSHOWS');
      t.ok(titles[0].length && titles[0].every(x => xs.includes(x)), 'zender 2 niet uit XMLTV: ' + titles[0].slice(0, 3));
      t.ok(titles[1].length && !titles[1].some(x => xs.includes(x)), 'zender 9 niet van de provider: ' + titles[1].slice(0, 3));
      // In de gids zelf
      await t.eval("App.section('guide'); 1");
      await t.until("Screens.guide.el.querySelectorAll('.g-prog:not(.empty)').length > 1", 10000, 'gids blijft leeg');
    }
  },
  {
    name: 'XMLTV: handmatig koppelen en provider-gids per zender',
    async run(t) {
      await withXmltv(t);
      // Zender 9 aan de extra gidszender koppelen: staat nog niet in de opgeslagen gids → opnieuw downloaden
      t.ok(await t.eval("Xmltv.link(1009, 'extra.demo')"), 'moet opnieuw downloaden');
      await t.eval('Xmltv.refresh(true).then(function () { return 1; })');
      t.ok(await t.eval('Xmltv.list(1009).then(function (l) { return l && l.length > 0; })'), 'geen gegevens na koppelen');
      // Zender 2 bewust op de provider-gids
      await t.eval("Xmltv.link(1002, '-'); 1");
      t.eq(await t.eval('Xmltv.list(1002)'), null, 'zender 2 gebruikt nog XMLTV');
      t.eq(await t.eval("Xmltv.search('extra').map(function (c) { return c.id; })"), ['extra.demo'], 'zoeken in de gidszenders');
    }
  },
  {
    name: 'XMLTV: ingepakte gids (.gz), tijdzones en tekens',
    async run(t) {
      await t.demo();
      // Twee keer: met de ingebouwde DecompressionStream (als de browser die heeft) en met js/inflate.js (oudere TV's)
      const run = (fallback) => t.eval(`fetch('/test/epg-t0.json').then(function (r) { return r.json(); }).then(function (meta) {
        return fetch('/test/epg.xml.gz').then(function (r) {
          var keep = window.DecompressionStream;
          if (${fallback}) window.DecompressionStream = undefined;
          return Xmltv.parse(r.body, { ids: {}, names: { npo1: 1 } }).then(function (res) {
            window.DecompressionStream = keep;
            var l = res.progs['a.nl'] || [];
            return { ch: res.channels.length, n: l.length, title: l[0] && l[0][2], desc: l[0] && l[0][3], ok: l[0] && l[0][0] === meta.t0 };
          }, function (e) { window.DecompressionStream = keep; throw e; });
        });
      })`);
      const r = await run(true);
      if (await t.eval('!!window.DecompressionStream')) t.eq(await run(false), r, 'ingebouwd uitpakken anders dan inflate.js');
      t.eq(r, { ch: 1, n: 1, title: 'Kaas & Wijn é', desc: 'Tekst <b>vet</b>', ok: true }, 'ingepakte gids (inflate.js)');
      t.eq(await t.eval("[Xmltv.time('20261007153000 +0200') === Date.UTC(2026, 9, 7, 13, 30), Xmltv.time('20261007153000 -0130') === Date.UTC(2026, 9, 7, 17, 0), Xmltv.time('20261007153000') === Date.UTC(2026, 9, 7, 15, 30)]"), [true, true, true], 'tijdzones');
      t.eq(await t.eval("['NL | NPO 1 HD', 'NPO 1', 'NPO1 FHD', 'RTL 4 (backup)'].map(Xmltv.nm)"), ['npo1', 'npo1', 'npo1', 'rtl4'], 'namen vergelijken');
    }
  },
  {
    name: 'XMLTV: terug naar de provider-gids',
    async run(t) {
      await withXmltv(t);
      await t.eval("Xmltv.setSource({ mode: 'api' }); EPG.reset(); 1");
      t.eq(await t.eval('Xmltv.list(1002)'), null, 'XMLTV nog actief');
    }
  },
  {
    name: 'Instelling: volgende aflevering automatisch, vragen of uit',
    async run(t) {
      await t.demo();
      const r = await t.eval(`(function () {
        var out = [], back = App.back;
        App.back = function () { out.push('terug'); };
        var fake = { live: false, markDone: function () {}, nextEpisode: function () { return { id: '1' }; }, askNext: function (n, auto) { out.push(auto ? 'auto' : 'vragen'); } };
        ['on', 'ask', 'off'].forEach(function (m) { Store.setSetting('autoNext', m); Screens.player.onEnded.call(fake); });
        App.back = back;
        return out;
      })()`);
      t.eq(r, ['auto', 'vragen', 'terug'], 'gedrag per instelling');
    }
  }
];
