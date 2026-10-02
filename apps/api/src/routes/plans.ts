import { FastifyInstance } from 'fastify';
import { prisma, PlanType } from '@wifi-billing/database';
import { z } from 'zod';

const planSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  price: z.number().positive(),
  currency: z.string().default('KES'),
  planType: z.nativeEnum(PlanType).default(PlanType.TIME_BASED),
  durationSec: z.number().int().positive().optional().nullable(),
  dataLimitBytes: z.number().positive().optional().nullable(),
  downloadSpeed: z.number().int().positive(), // kbps
  uploadSpeed: z.number().int().positive(),   // kbps
  burstDown: z.number().int().positive().optional().nullable(),
  burstUp: z.number().int().positive().optional().nullable(),
  maxDevices: z.number().int().positive().default(1),
  locationId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export async function planRoutes(fastify: FastifyInstance) {
  // 1. GET /api/plans - Fetch plans (active by default, or all if ?all=true)
  fastify.get('/plans', async (req, reply) => {
    const { all } = req.query as { all?: string };
    const where = all === 'true' ? {} : { isActive: true };

    const plans = await prisma.plan.findMany({
      where,
      orderBy: { price: 'asc' },
    });

    const serialized = plans.map((plan) => ({
      ...plan,
      price: Number(plan.price),
      dataLimitBytes: plan.dataLimitBytes ? plan.dataLimitBytes.toString() : null,
    }));

    return reply.send({
      success: true,
      data: serialized,
    });
  });

  // 2. GET /api/plans/:id - Fetch single plan details
  fastify.get('/plans/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const plan = await prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      return reply.status(404).send({ success: false, error: 'Plan not found' });
    }

    return reply.send({
      success: true,
      data: {
        ...plan,
        price: Number(plan.price),
        dataLimitBytes: plan.dataLimitBytes ? plan.dataLimitBytes.toString() : null,
      },
    });
  });

  // 3. POST /api/plans - Create a new plan from Admin Dashboard
  fastify.post('/plans', async (req, reply) => {
    try {
      const body = planSchema.parse(req.body);

      // If locationId not provided, assign to default location
      let locationId = body.locationId;
      if (!locationId) {
        const defaultLoc = await prisma.location.findFirst();
        locationId = defaultLoc?.id;
      }

      const created = await prisma.plan.create({
        data: {
          name: body.name,
          description: body.description ?? null,
          price: body.price,
          currency: body.currency,
          planType: body.planType,
          durationSec: body.durationSec ?? null,
          dataLimitBytes: body.dataLimitBytes ? BigInt(body.dataLimitBytes) : null,
          downloadSpeed: body.downloadSpeed,
          uploadSpeed: body.uploadSpeed,
          burstDown: body.burstDown ?? null,
          burstUp: body.burstUp ?? null,
          maxDevices: body.maxDevices,
          locationId: locationId ?? null,
          isActive: body.isActive ?? true,
        },
      });

      return reply.status(201).send({
        success: true,
        message: `Plan "${created.name}" created successfully`,
        data: {
          ...created,
          price: Number(created.price),
          dataLimitBytes: created.dataLimitBytes ? created.dataLimitBytes.toString() : null,
        },
      });
    } catch (err: any) {
      fastify.log.error(err, 'Failed to create plan');
      return reply.status(400).send({
        success: false,
        error: err.message || 'Invalid plan data',
      });
    }
  });

  // 4. PUT /api/plans/:id - Update existing plan parameters (price, speeds, quotas)
  fastify.put('/plans/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const body = planSchema.parse(req.body);

      const existing = await prisma.plan.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Plan not found' });
      }

      const updated = await prisma.plan.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description ?? null,
          price: body.price,
          currency: body.currency,
          planType: body.planType,
          durationSec: body.durationSec ?? null,
          dataLimitBytes: body.dataLimitBytes ? BigInt(body.dataLimitBytes) : null,
          downloadSpeed: body.downloadSpeed,
          uploadSpeed: body.uploadSpeed,
          burstDown: body.burstDown ?? null,
          burstUp: body.burstUp ?? null,
          maxDevices: body.maxDevices,
          isActive: body.isActive ?? existing.isActive,
        },
      });

      return reply.send({
        success: true,
        message: `Plan "${updated.name}" updated successfully`,
        data: {
          ...updated,
          price: Number(updated.price),
          dataLimitBytes: updated.dataLimitBytes ? updated.dataLimitBytes.toString() : null,
        },
      });
    } catch (err: any) {
      fastify.log.error(err, 'Failed to update plan');
      return reply.status(400).send({
        success: false,
        error: err.message || 'Failed to update plan',
      });
    }
  });

  // 5. PATCH /api/plans/:id/toggle - Toggle active / deactivated
  fastify.patch('/plans/:id/toggle', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const existing = await prisma.plan.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Plan not found' });
      }

      const updated = await prisma.plan.update({
        where: { id },
        data: { isActive: !existing.isActive },
      });

      return reply.send({
        success: true,
        message: `Plan is now ${updated.isActive ? 'Active' : 'Deactivated'}`,
        data: { id: updated.id, isActive: updated.isActive },
      });
    } catch (err: any) {
      fastify.log.error(err, 'Failed to toggle plan status');
      return reply.status(500).send({ success: false, error: 'Failed to toggle plan status' });
    }
  });

  // 6. DELETE /api/plans/:id - Soft-delete (deactivate) plan
  fastify.delete('/plans/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const existing = await prisma.plan.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Plan not found' });
      }

      await prisma.plan.update({
        where: { id },
        data: { isActive: false },
      });

      return reply.send({
        success: true,
        message: `Plan "${existing.name}" deactivated successfully`,
      });
    } catch (err: any) {
      fastify.log.error(err, 'Failed to delete plan');
      return reply.status(500).send({ success: false, error: 'Failed to delete plan' });
    }
  });
}
