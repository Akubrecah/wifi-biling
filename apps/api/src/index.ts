import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import dotenv from 'dotenv';
import { prisma } from '@wifi-billing/database';
import { errorHandler } from './plugins/error-handler.js';
import { healthRoutes } from './routes/health.js';

dotenv.config();

const port = Number(process.env['API_PORT']) || 3001;
const host = process.env['API_HOST'] || '0.0.0.0';

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] || 'info',
    },
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
  });

  // Security Headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Managed by Nginx / Captive portal
  });

  // Cross-Origin Resource Sharing
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Global Rate Limiting
  await fastify.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  // Centralized Error Handler
  fastify.setErrorHandler(errorHandler);

  // Register Routes
  await fastify.register(healthRoutes, { prefix: '/api' });
  await fastify.register(healthRoutes); // root /health and /ready fallback

  return fastify;
}

export async function start() {
  const app = await buildApp();

  // Graceful Shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}. Shutting down gracefully...`);
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port, host });
    app.log.info(`🚀 API Gateway active on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Auto-start when executed directly
if (process.argv[1]?.endsWith('src/index.ts') || process.argv[1]?.endsWith('dist/index.js')) {
  void start();
}
