// Kleine webserver voor de tests (zelfde idee als scripts/serve.py): bestanden uit de projectmap, zonder caching.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

// Start op een vrije poort; geeft { url, close } terug.
// overrides: { '/pad': 'inhoud' } om bestanden te vervangen (bv. een lege js/config.local.js, zonder TMDB-sleutel)
export function serve(root, overrides = {}) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    if (overrides[p] != null) {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'text/plain', 'Cache-Control': 'no-store' });
      res.end(overrides[p]);
      return;
    }
    const file = path.join(root, path.normalize(p));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(c => server.close(c))
  })));
}
