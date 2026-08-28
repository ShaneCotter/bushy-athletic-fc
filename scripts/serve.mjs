import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const PORT = Number(process.env.PORT) || 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const pathname = req.url?.split('?')[0] ?? '/';
  let path = join(ROOT, pathname === '/' ? 'index.html' : pathname);

  if (existsSync(path) && statSync(path).isDirectory()) {
    path = join(path, 'index.html');
  }

  if (!existsSync(path) || statSync(path).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': MIME[extname(path)] || 'application/octet-stream',
  });
  res.end(readFileSync(path));
}).listen(PORT, () => {
  console.log(`UCFL dashboard running at http://localhost:${PORT}`);
});
