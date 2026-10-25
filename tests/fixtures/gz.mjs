// Ingepakte XMLTV-gids (gzip, gemaakt met zlib van Node) voor de test van het uitpakken, ook op oude browsers zonder CompressionStream
import zlib from 'node:zlib';
export function gzFixtures() {
  const pad = n => (n < 10 ? '0' : '') + n;
  const fmt = t => { const d = new Date(t); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00 +0000'; };
  const t0 = Math.floor(Date.now() / 60000) * 60000;
  // Genoeg programma's voor meerdere DEFLATE-blokken; het eerste is het programma dat de test controleert
  let progs = `<programme start="${fmt(t0)}" stop="${fmt(t0 + 3600e3)}" channel="A.nl"><title>Kaas &amp; Wijn &#233;</title><desc><![CDATA[Tekst <b>vet</b>]]></desc></programme>\n`;
  for (let i = 1; i < 3000; i++) progs += `<programme start="${fmt(t0 + i * 60e3)}" stop="${fmt(t0 + (i + 1) * 60e3)}" channel="B.nl"><title>Programma ${i}</title></programme>\n`;
  const xml = `<?xml version="1.0"?><tv><channel id="A.nl"><display-name>NPO 1</display-name></channel>${progs}</tv>`;
  return { '/test/epg.xml.gz': zlib.gzipSync(Buffer.from(xml), { level: 9 }), '/test/epg-t0.json': JSON.stringify({ t0 }) };
}
