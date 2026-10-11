// Test-afspeellijst (M3U) en bijbehorende XMLTV-gids, geserveerd door de testserver onder /test/…
// Tijden in de gids zijn rond "nu", zodat de gids iets laat zien.
export function m3uFixtures() {
  const list = `#EXTM3U x-tvg-url="/test/epg.xml"
#EXTINF:-1 tvg-id="nos1.nl" tvg-name="NPO 1" tvg-logo="" tvg-chno="1" group-title="NL | Nieuws",NPO 1 HD
http://example.invalid/live/user/pass/101.m3u8
#EXTINF:-1 tvg-id="rtl4.nl" tvg-logo="" group-title="NL | Nieuws",RTL 4
http://example.invalid/live/user/pass/102.ts
#EXTINF:-1 tvg-id="" group-title="Sport, extra",Sportzender
http://cdn.example.invalid/sport/index.m3u8
#EXTINF:-1 group-title="Films | Actie",De Testfilm (2023)
http://example.invalid/movie/user/pass/5001.mkv
#EXTINF:-1 group-title="Films | Actie",Losse Film
http://files.example.invalid/films/losse-film.mp4
#EXTINF:-1 tvg-logo="" group-title="Series | Drama",Mijn Serie S01E01
http://example.invalid/series/user/pass/9001.mkv
#EXTINF:-1 group-title="Series | Drama",Mijn Serie S01 E02
http://example.invalid/series/user/pass/9002.mkv
#EXTINF:-1 group-title="Series | Drama",Mijn Serie - S02E01
http://files.example.invalid/series/mijn-serie-s02e01.mp4
`;
  const pad = n => (n < 10 ? '0' : '') + n;
  const fmt = t => { const d = new Date(t); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00 +0000'; };
  const t0 = Math.floor(Date.now() / 3600e3) * 3600e3 - 3600e3;
  let progs = '';
  for (const ch of ['nos1.nl', 'rtl4.nl']) {
    for (let i = 0; i < 8; i++) progs += `<programme start="${fmt(t0 + i * 3600e3)}" stop="${fmt(t0 + (i + 1) * 3600e3)}" channel="${ch}"><title>Programma ${i + 1} op ${ch}</title></programme>\n`;
  }
  const epg = `<?xml version="1.0" encoding="UTF-8"?><tv>
<channel id="nos1.nl"><display-name>NPO 1</display-name></channel>
<channel id="rtl4.nl"><display-name>RTL 4</display-name></channel>
${progs}</tv>`;
  return { '/test/list.m3u': list, '/test/epg.xml': epg };
}
