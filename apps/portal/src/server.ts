import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find public directory reliably across dev (ts-node) and prod (dist)
function resolvePublicDir(): string {
  const candidates = [
    path.resolve(__dirname, 'public'),
    path.resolve(__dirname, '../public'),
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'apps/portal/public'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.resolve(__dirname, '../public');
}

const publicDir = resolvePublicDir();
const port = Number(process.env['PORTAL_PORT']) || 3000;
const host = process.env['PORTAL_HOST'] || '0.0.0.0';

export async function buildPortalApp() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] || 'info',
    },
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // Self-contained zero-CDN captive portal
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
  });

  // Health check for Docker / Nginx
  app.get('/health', async () => ({ status: 'ok', service: 'portal' }));

  // Captive Portal standard route fallbacks (RFC 8952, Apple CNA, Android probe)
  const portalRoutes = ['/hotspot', '/login', '/status', '/generate_204', '/hotspot-detect.html', '/ncsi.txt'];
  for (const route of portalRoutes) {
    app.get(route, async (_req, reply) => {
      return reply.sendFile('index.html');
    });
  }

  // 404 fallback to index.html for SPA routing
  app.setNotFoundHandler((_req, reply) => {
    return reply.sendFile('index.html');
  });

  return app;
}

export async function start() {
  const app = await buildPortalApp();

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}. Shutting down portal...`);
      await app.close();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port, host });
    app.log.info(`🌐 Captive Portal listening on http://${host}:${port} (serving ${publicDir})`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  void start();
}
