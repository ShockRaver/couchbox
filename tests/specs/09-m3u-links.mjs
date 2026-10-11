// M3U-afspeellijsten, inloggen met één link, en automatisch ander streamformaat bij live-zenders
async function loginWith(t, server, user = '', pass = '') {
  await t.open();
  await t.until('App.screen() === Screens.login');
  await t.eval(`(function () {
    var f = {}; Screens.login.fields.forEach(function (x) { f[x.key] = x.input; });
    f.server.value = ${JSON.stringify(server)}; f.username.value = ${JSON.stringify(user)}; f.password.value = ${JSON.stringify(pass)};
    Screens.login.connect(); return 1;
  })()`);
}

export default [
  {
    name: 'Link herkennen: demo, server, Xtream-link, M3U',
    async run(t) {
      await t.open();
      const r = await t.eval(`[
        Api.parseLink('demo'),
        Api.parseLink('voorbeeld.com:8080', 'jan', 'geheim'),
        Api.parseLink('http://voorbeeld.com:8080/get.php?username=jan&password=ge%26heim&type=m3u_plus&output=ts'),
        Api.parseLink('http://voorbeeld.com:8080/player_api.php?username=jan&password=x'),
        Api.parseLink('https://lijst.example.com/mijn/lijst.m3u8?token=abc'),
        Api.parseLink('voorbeeld.com:8080'),
        Api.parseLink('')
      ].map(function (x) { return x.error ? 'fout' : [x.type, x.server || '', x.username || '', x.password || '', x.url || ''].join('|'); })`);
      t.eq(r, [
        'demo|demo|||',
        'xtream|http://voorbeeld.com:8080|jan|geheim|',
        'xtream|http://voorbeeld.com:8080|jan|ge&heim|',
        'xtream|http://voorbeeld.com:8080|jan|x|',
        'm3u|https://lijst.example.com/mijn/lijst.m3u8?token=abc|||https://lijst.example.com/mijn/lijst.m3u8?token=abc',
        'fout',
        'fout'
      ], 'herkende links');
    }
  },
  {
    name: 'M3U lezen: zenders, films, series, groepen en gidsadres',
    async run(t) {
      await t.open();
      const r = await t.eval(`fetch('/test/list.m3u').then(function (x) { return x.text(); }).then(function (txt) {
        var d = M3U.parseText(txt);
        return {
          epg: d.epg,
          live: d.live.map(function (c) { return c.name + '|' + c.stream_id + '|' + c.epg_channel_id + '|' + c.num; }),
          vod: d.vod.map(function (m) { return m.name + '|' + m.container_extension; }),
          series: d.series.map(function (s) { return s.name + ':' + Object.keys(s.eps).map(function (k) { return k + 'x' + s.eps[k].length; }).join(','); }),
          groups: d.cats.liveCats.map(function (c) { return c.category_name; })
        };
      })`);
      t.eq(r.epg, '/test/epg.xml', 'gidsadres uit de kop');
      t.eq(r.live.length, 3, 'zenders');
      t.ok(r.live[0].startsWith('NPO 1 HD|101|nos1.nl|1'), 'Xtream-id, tvg-id en kanaalnummer: ' + r.live[0]);
      t.eq(r.vod, ['De Testfilm (2023)|mkv', 'Losse Film|mp4'], 'films');
      t.eq(r.series, ['Mijn Serie:1x2,2x1'], 'serie met seizoenen');
      t.eq(r.groups, ['NL | Nieuws', 'Sport, extra'], 'groepen (ook met komma)');
    }
  },
  {
    name: 'Inloggen met een M3U-link en alles bekijken',
    async run(t) {
      await loginWith(t, t.base + '/test/list.m3u');
      await t.until('App.screen() === Screens.home', 10000, 'niet naar Home na inloggen');
      t.eq(await t.eval("[Store.activeProfile().type, Api.isM3u()]"), ['m3u', true], 'profiel is een afspeellijst');
      // Live TV
      await t.eval("App.section('live'); 1");
      await t.until("App.screen() === Screens.live && Screens.live.catList && Screens.live.all.length === 3", 8000, 'zenders uit de lijst');
      t.eq(await t.eval("Api.liveUrl(Screens.live.all[0])"), 'http://example.invalid/live/user/pass/101.m3u8', 'stream-adres uit de lijst');
      // Gids: standaard de XMLTV-gids uit de lijst
      t.eq(await t.eval("Xmltv.source().mode"), 'xmltv', 'gidsbron bij een afspeellijst');
      const m = await t.eval('Xmltv.refresh(true).then(function (m) { return [m.matched, m.total]; })');
      t.eq(m, [2, 3], 'zenders gekoppeld aan de gids');
      t.ok(await t.eval("Xmltv.list(101).then(function (l) { return l && l.length > 3 && /Programma/.test(l[0].title); })"), 'geen programma\'s voor NPO 1');
      // Films en series
      t.eq(await t.eval('Api.vodStreams(null).then(function (l) { return l.length; })'), 2, 'films');
      const s = await t.eval("Api.series(null).then(function (l) { return Api.seriesInfo(l[0].series_id); }).then(function (i) { return [i.seasons.length, i.episodes[1].length, i.episodes[1][1].episode_num]; })");
      t.eq(s, [2, 2, 2], 'seizoenen en afleveringen');
      t.eq(await t.eval("Api.episodeUrl({ id: '9002' })"), 'http://example.invalid/series/user/pass/9002.mkv', 'adres van een aflevering');
      // Profielenlijst toont geen volledig adres (kan een token bevatten)
      t.ok(!(await t.eval("Screens.profiles && Store.profiles()[0].server.indexOf('?') >= 0")), 'token in de profielnaam');
    }
  },
  {
    name: 'Inloggen met een Xtream-link vult gebruikersnaam en wachtwoord zelf in',
    async run(t) {
      await t.open();
      await t.until('App.screen() === Screens.login');
      // Niet echt verbinden: alleen kijken wat er van de link wordt gemaakt
      const p = await t.eval(`(function () {
        var got = null, login = Api.login; Api.login = function () { got = Api.profile(); return Promise.reject(new Error('test')); };
        var f = {}; Screens.login.fields.forEach(function (x) { f[x.key] = x.input; });
        f.server.value = 'http://tv.example.com:8080/get.php?username=piet&password=abc123&type=m3u_plus';
        Screens.login.connect(); Api.login = login;
        return [got.type, got.server, got.username, got.password];
      })()`);
      t.eq(p, ['xtream', 'http://tv.example.com:8080', 'piet', 'abc123'], 'profiel uit de link');
    }
  },
  {
    name: 'Live-zender: ander streamformaat als reserve, en onthouden wat werkt',
    async run(t) {
      await t.demo();
      const r = await t.eval(`(function () {
        Api.setProfile({ id: 'x', type: 'xtream', server: 'http://tv.example.com:8080', username: 'a', password: 'b' });
        var ch = { stream_id: 7, name: 'Test' }, o = Api.liveOpts(ch), first = Api.liveUrl(ch);
        o.onAlt(o.alt);   // zoals de speler doet als het andere formaat wel speelt
        var after = Api.liveUrl(ch);
        return [first, o.alt, after, Api.swapFormat('http://x/a/b.ts?t=1'), Api.swapFormat('http://x/stream')];
      })()`);
      t.eq(r, ['http://tv.example.com:8080/live/a/b/7.m3u8', 'http://tv.example.com:8080/live/a/b/7.ts', 'http://tv.example.com:8080/live/a/b/7.ts',
        'http://x/a/b.m3u8?t=1', 'http://x/stream'], 'formaten');
    }
  },
  {
    name: 'Speler probeert het andere formaat voordat hij opnieuw probeert',
    async run(t) {
      await t.demo();
      // Een stream die niet bestaat: eerst .m3u8, dan meteen .ts, en pas daarna gewone nieuwe pogingen
      const u = t.base + '/bestaat-niet/1';
      const r = await t.eval(`new Promise(function (done) {
        // Klaar zodra er twee pogingen zijn (op GitHub duurt de eerste fout soms langer), uiterlijk na 15 s
        var urls = [], t0 = null, finish = function () { clearTimeout(t0); off(); Player.stop(); done(urls.slice(0, 2)); };
        var off = Player.on('state', function (s) { if (s === 'loading') { urls.push(Player.url()); if (urls.length >= 2) setTimeout(finish, 0); } });
        Player.play('${u}.m3u8', { live: true, meta: { stream_id: 1 }, alt: '${u}.ts' });
        t0 = setTimeout(finish, 15000);
      })`);
      t.eq(r, [t.base + '/bestaat-niet/1.m3u8', t.base + '/bestaat-niet/1.ts'], 'volgorde van pogingen');
    },
    allow: /Speler-fout|Afspeelfout|Failed to load|NotSupported|404/
  }
];
