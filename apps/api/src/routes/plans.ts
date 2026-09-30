import { FastifyInstance } from 'fastify';
import { prisma, PlanType } from '@wifi-billing/database';
import { z } from 'zod';

const createPlanSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
  currency: z.string().default('KES'),
  planType: z.nativeEnum(PlanType).default(PlanType.TIME_BASED),
  durationSec: z.number().int().positive().optional(),
  dataLimitBytes: z.number().positive().optional(),
  downloadSpeed: z.number().int().positive(), // kbps
  uploadSpeed: z.number().int().positive(),   // kbps
  burstDown: z.number().int().positive().optional(),
  burstUp: z.number().int().positive().optional(),
  maxDevices: z.number().int().positive().default(1),
  locationId: z.string().uuid().optional(),
});

export async function planRoutes(fastify: FastifyInstance) {
  // GET /api/plans - Fetch all active plans for Captive Portal and Admin
  fastify.get('/plans', async (_req, reply) => {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
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

  // POST /api/plans - Create a new plan from Admin Dashboard
  fastify.post('/plans', async (req, reply) => {
    const body = createPlanSchema.parse(req.body);

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
        isActive: true,
      },
    });

    return reply.status(201).send({
      success: true,
      data: {
        ...created,
        price: Number(created.price),
        dataLimitBytes: created.dataLimitBytes ? created.dataLimitBytes.toString() : null,
      },
    });
  });
}
