import { FastifyInstance } from 'fastify';
import { prisma } from '@wifi-billing/database';

export async function healthRoutes(fastify: FastifyInstance) {
  // Liveness Check
  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  // Readiness Check (Validates database connectivity)
  fastify.get('/ready', async (request, reply) => {
    const checks: Record<string, 'ok' | 'error'> = {
      database: 'error',
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks['database'] = 'ok';
    } catch (err) {
      request.log.error({ err }, 'Readiness check: database failure');
    }

    const isHealthy = Object.values(checks).every((status) => status === 'ok');

    if (!isHealthy) {
      return reply.status(503).send({
        status: 'unhealthy',
        checks,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  });
}
