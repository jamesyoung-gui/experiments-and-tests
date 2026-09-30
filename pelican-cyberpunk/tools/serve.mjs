// Minimal static server for the ES-module dev page. usage: node tools/serve.mjs [port=5173]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
export function serve(port = 0) {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let p = path.join(ROOT, u === '/' ? '/src/index.dev.html' : u);
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end('not found'); }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(port, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await serve(+(process.argv[2] || 5173));
  console.log(`http://127.0.0.1:${port}/src/index.dev.html`);
}
