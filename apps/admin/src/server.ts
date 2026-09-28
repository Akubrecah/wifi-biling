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

function resolvePublicDir(): string {
  const candidates = [
    path.resolve(__dirname, 'public'),
    path.resolve(__dirname, '../public'),
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'apps/admin/public'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.resolve(__dirname, '../public');
}

const publicDir = resolvePublicDir();
const port = Number(process.env['ADMIN_PORT']) || 3002;
const host = process.env['ADMIN_HOST'] || '0.0.0.0';

export async function buildAdminApp() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] || 'info',
    },
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
  });

  app.get('/health', async () => ({ status: 'ok', service: 'admin' }));

  app.setNotFoundHandler((_req, reply) => {
    return reply.sendFile('index.html');
  });

  return app;
}

export async function start() {
  const app = await buildAdminApp();

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}. Shutting down admin dashboard...`);
      await app.close();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port, host });
    app.log.info(`🛡️ Admin Management Platform running on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  void start();
}
