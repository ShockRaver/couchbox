// Externe ondertitels (OpenSubtitles): lezen, zoeken, downloaden en tonen in de speler (met een nagebootste API)
const useFake = "CONFIG.osApi = '/test/os/'; Store.setSetting('osKey', 'TestSleutel1234567890'); 1";

export default [
  {
    name: 'Ondertitels lezen: SRT en WebVTT, opmaak weg, overlappende regels samen',
    async run(t) {
      await t.open();
      const r = await t.eval(`(function () {
        var srt = Subs.parse('1\\r\\n00:00:01,000 --> 00:00:02,000\\r\\n<b>Een</b>\\r\\n\\r\\n2\\r\\n00:00:01,500 --> 00:00:04,000\\r\\n{\\\\an8}Twee\\r\\n');
        var vtt = Subs.parse('WEBVTT\\n\\n00:01.5 --> 00:02.250 align:start\\nKort\\n\\nNOTE niets\\n\\n01:00:00.000 --> 01:00:01.000\\nUur\\n');
        return [srt.map(function (c) { return c.s + '-' + c.e + ':' + c.text; }), vtt.map(function (c) { return c.s + '-' + c.e + ':' + c.text; }),
          Subs.at(srt, 500), Subs.at(srt, 1700), Subs.at(srt, 3000), Subs.at(srt, 5000)];
      })()`);
      t.eq(r[0], ['1000-2000:Een', '1500-4000:Twee'], 'SRT');
      t.eq(r[1], ['1500-2250:Kort', '3600000-3601000:Uur'], 'WebVTT');
      t.eq(r.slice(2), ['', 'Een\nTwee', 'Twee', ''], 'tekst op tijdstip');
      t.eq(await t.eval("Subs.clean('NL | The Matrix (1999) [4K]')"), 'The Matrix', 'titel opschonen');
    }
  },
  {
    name: 'OpenSubtitles: zoeken (voorkeurstaal eerst) en downloaden (daarna uit de lokale opslag)',
    async run(t) {
      await t.open();
      await t.eval(useFake);
      const r = await t.eval(`Subs.search({ kind: 'm', tmdb: '10378', langs: ['nl', 'en'] }).then(function (l) {
        return l.map(function (s) { return s.fileId + ':' + s.lang + (s.ai ? ':ai' : ''); });
      })`);
      t.eq(r, ['13:nl', '12:nl:ai', '11:en'], 'volgorde (zonder bestand overgeslagen)');
      const a = await t.eval("Subs.load(13).then(function (x) { return [x.cues.length, x.cues[1].text, x.remaining]; })");
      t.eq(a, [2, 'Café\ntweede regel', 4], 'download (Windows-1252 goed gelezen)');
      t.eq(await t.eval('Subs.load(13).then(function (x) { return x.remaining; })'), null, 'tweede keer opnieuw gedownload');
    }
  },
  {
    name: 'Speler: externe ondertitels tonen, synchroniseren en per film onthouden',
    async run(t) {
      await t.demo();
      await t.eval(useFake);
      await t.eval("App.go('player', { mode: 'movie', item: { id: '5001', name: 'Testfilm', ext: 'mp4', tmdb: '' } }); 1");
      await t.until('App.screen() === Screens.player');
      await t.eval("window._time = Player.time; Player.time = function () { return 2000; }; Screens.player.loadExt({ fileId: 13, lang: 'nl', label: 'Nederlands' }, true); 1");
      await t.until('Screens.player.ext && Screens.player.subEl.textContent === "Hallo wereld"', 5000, 'ondertitel niet getoond');
      // 1,5 s later tonen: op 2 s speeltijd is het dan nog 0,5 s in het bestand (niets)
      await t.eval("Screens.player.subsMenu(); 1");
      const items = await t.eval("Array.from(document.querySelectorAll('.dialog .di-label')).map(function (e) { return e.textContent; })");
      t.ok(items.some(i => /OpenSubtitles/.test(i)), 'menu zonder OpenSubtitles: ' + items);
      await t.eval("Dialog.onKey('back'); [1, 2, 3].forEach(function () { var x = Screens.player.ext; x.offset += 500; }); Screens.player.extSave({ fileId: 13, lang: 'nl', label: 'Nederlands', offset: 1500 }); Screens.player.extText = null; Screens.player.tickExt(); 1");
      t.eq(await t.eval('Screens.player.subEl.textContent'), '', 'verschoven ondertitel');
      // Opnieuw starten: zelfde bestand en verschuiving terug, zonder download
      await t.eval("App.back(); App.go('player', { mode: 'movie', item: { id: '5001', name: 'Testfilm', ext: 'mp4', tmdb: '' } }); 1");
      await t.until('App.screen() === Screens.player && Screens.player.ext', 5000, 'ondertitels niet teruggezet');
      t.eq(await t.eval('[Screens.player.ext.fileId, Screens.player.ext.offset]'), [13, 1500], 'teruggezet');
      await t.eval('Player.time = window._time; 1');
    },
    allow: /Speler-fout|Afspeelfout|Failed to load|NotSupported|404|ERR_/
  }
];
