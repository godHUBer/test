// Minimal static preview server for the Next.js static export.
// Serves the out/ directory and maps the /test/ basePath prefix to the root,
// so the basePath-prefixed links in the built HTML resolve in the preview.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';

const ROOT = join(process.cwd(), 'out');
const BASE = '/test';
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    let url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith(BASE)) pathname = pathname.slice(BASE.length) || '/';
    if (pathname === '/') pathname = '/index.html';
    let filePath = normalize(join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) { filePath = join(filePath, 'index.html'); info = await stat(filePath).catch(() => null); }
    if (!info) {
      // SPA-style fallback for client routes.
      filePath = join(ROOT, '404.html');
      info = await stat(filePath).catch(() => null);
      if (!info) { res.writeHead(404); return res.end('Not found'); }
    }
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Preview serving out/ on http://0.0.0.0:${PORT}${BASE}/`));
