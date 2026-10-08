import { createReadStream, readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rateBoard from '../netlify/functions/rate-board.mjs';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../www.gexfi.com');
const redirects = new Map(readFileSync(path.join(site, '_redirects'), 'utf8')
  .split('\n')
  .map(line => line.trim().split(/\s+/))
  .filter(parts => parts.length === 3)
  .map(([source, destination, status]) => [source, { destination, status: Number(status) }]));
const port = Number(process.env.PREVIEW_PORT || 4195);
const host = process.env.PREVIEW_HOST || '127.0.0.1';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/.netlify/functions/rate-board') {
      const response = await rateBoard(new Request(url, { method: req.method }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    const redirect = redirects.get(url.pathname);
    if (redirect) {
      res.writeHead(redirect.status, { Location: redirect.destination });
      res.end();
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.split('/').some(part => part.startsWith('.') || part === '_headers' || part === '_redirects')) {
      res.writeHead(404);
      res.end();
      return;
    }
    let target = path.resolve(site, `.${pathname}`);
    if (target !== site && !target.startsWith(`${site}${path.sep}`)) {
      res.writeHead(404);
      res.end();
      return;
    }
    let info = await stat(target);
    if (info.isDirectory()) {
      target = path.join(target, 'index.html');
      info = await stat(target);
    }
    if (!info.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(port, host, () => {
  process.stdout.write(`GEXFI preview listening on http://${host}:${port}/\n`);
});
