import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};
http
  .createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const filename = path.resolve(
        root,
        '.' + (pathname === '/' ? '/design-review.html' : pathname),
      );
      const relative = path.relative(root, filename);
      if (
        relative.startsWith('..') ||
        path.isAbsolute(relative) ||
        !types[path.extname(filename)]
      ) {
        response.writeHead(403).end('Acesso indisponível');
        return;
      }
      const body = await readFile(filename);
      response.writeHead(200, {
        'Content-Type': types[path.extname(filename)],
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('Arquivo não encontrado');
    }
  })
  .listen(27120, '127.0.0.1', () =>
    console.log('OmniGear design: http://127.0.0.1:27120/design-review.html'),
  );
