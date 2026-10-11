// Nagebootste OpenSubtitles-API voor de tests (de app gebruikt CONFIG.osApi = '/test/os/'); de server kijkt niet naar de methode
export function osFixtures() {
  const res = {
    data: [
      { attributes: { language: 'en', download_count: 900, release: 'Big.Buck.Bunny.EN', files: [{ file_id: 11, file_name: 'bbb.en.srt' }] } },
      { attributes: { language: 'nl', download_count: 50, release: 'Big.Buck.Bunny.NL.ai', ai_translated: true, files: [{ file_id: 12 }] } },
      { attributes: { language: 'nl', download_count: 10, release: 'Big.Buck.Bunny.NL', files: [{ file_id: 13 }] } },
      { attributes: { language: 'nl', download_count: 5, release: 'zonder bestand', files: [] } }
    ]
  };
  // Windows-1252: "Café" met é = 0xE9 (geen geldige UTF-8)
  const srt = Buffer.concat([Buffer.from('1\r\n00:00:01,000 --> 00:00:03,500\r\n<i>Hallo</i> wereld\r\n\r\n2\r\n00:00:03,000 --> 00:00:05,000\r\nCaf'), Buffer.from([0xe9]), Buffer.from('\r\ntweede regel\r\n\r\n')]);
  return {
    '/test/os/subtitles': JSON.stringify(res),
    '/test/os/download': JSON.stringify({ link: '/test/os/file.srt', remaining: 4 }),
    '/test/os/file.srt': srt
  };
}
