import { readdirSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** Serves api/*.ts (Vercel web-standard handlers) during `vite dev`. */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', process.cwd(), ''));
      const routes = new Set(readdirSync('api').filter((f) => f.endsWith('.ts')).map((f) => f.slice(0, -3)));
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const route = url.pathname.match(/^\/api\/([\w-]+)$/)?.[1];
        if (!route || !routes.has(route)) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${route}.ts`);
          const handler = mod[req.method ?? 'GET'];
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const hasBody = !['GET', 'HEAD'].includes(req.method ?? 'GET');
          const response: Response = await handler(
            new Request(url, {
              method: req.method,
              headers: req.headers as Record<string, string>,
              body: hasBody ? Buffer.concat(chunks) : undefined,
            }),
          );
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.end('Internal error');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  test: { include: ['tests/**/*.test.ts'] },
});
