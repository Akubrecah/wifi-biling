import { FastifyInstance } from 'fastify';
import { prisma, VoucherStatus, EntitlementStatus } from '@wifi-billing/database';
import { z } from 'zod';
import crypto from 'node:crypto';

// Character set avoiding ambiguous characters (0, O, 1, I, L)
const VOUCHER_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateVoucherCode(): string {
  let part1 = '';
  let part2 = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 4; i++) {
    part1 += VOUCHER_CHARS[bytes[i]! % VOUCHER_CHARS.length];
    part2 += VOUCHER_CHARS[bytes[i + 4]! % VOUCHER_CHARS.length];
  }
  return `${part1}-${part2}`;
}

const generateBatchSchema = z.object({
  batchName: z.string().min(2).max(100),
  planId: z.string().uuid(),
  quantity: z.number().int().min(1).max(500),
  locationId: z.string().uuid().optional(),
});

const redeemVoucherSchema = z.object({
  code: z.string().min(4).max(20),
  macAddress: z.string().optional(),
  ipAddress: z.string().optional(),
});

export async function voucherRoutes(fastify: FastifyInstance) {
  // 1. GET /api/vouchers/batches - List all voucher batches
  fastify.get('/vouchers/batches', async (_req, reply) => {
    try {
      const batches = await prisma.voucherBatch.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              price: true,
              currency: true,
              durationSec: true,
              dataLimitBytes: true,
              downloadSpeed: true,
            },
          },
          _count: {
            select: { vouchers: true },
          },
        },
      });

      // Calculate availability counts per batch
      const serialized = await Promise.all(
        batches.map(async (batch) => {
          const availableCount = await prisma.voucher.count({
            where: { batchId: batch.id, status: VoucherStatus.AVAILABLE },
          });
          const usedCount = await prisma.voucher.count({
            where: { batchId: batch.id, status: VoucherStatus.USED },
          });

          return {
            id: batch.id,
            name: batch.name,
            quantity: batch.quantity,
            totalCreated: batch._count.vouchers,
            available: availableCount,
            used: usedCount,
            createdAt: batch.createdAt,
            plan: {
              ...batch.plan,
              price: Number(batch.plan.price),
              dataLimitBytes: batch.plan.dataLimitBytes ? batch.plan.dataLimitBytes.toString() : null,
            },
          };
        })
      );

      return reply.send({ success: true, data: serialized });
    } catch (err: any) {
      fastify.log.error(err, 'Failed to list voucher batches');
      return reply.status(500).send({ success: false, error: 'Could not fetch voucher batches' });
    }
  });

  // 2. GET /api/vouchers/batches/:id - Fetch vouchers in a batch (for printing/export)
  fastify.get('/vouchers/batches/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const batch = await prisma.voucherBatch.findUnique({
        where: { id },
        include: {
          plan: true,
          vouchers: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!batch) {
        return reply.status(404).send({ success: false, error: 'Voucher batch not found' });
      }

      return reply.send({
        success: true,
        data: {
          id: batch.id,
          name: batch.name,
          plan: {
            ...batch.plan,
            price: Number(batch.plan.price),
            dataLimitBytes: batch.plan.dataLimitBytes ? batch.plan.dataLimitBytes.toString() : null,
          },
          vouchers: batch.vouchers.map((v) => ({
            id: v.id,
            code: v.code,
            status: v.status,
            claimedMac: v.claimedMac,
            activatedAt: v.activatedAt,
          })),
        },
      });
    } catch (err: any) {
      fastify.log.error(err, 'Failed to fetch batch vouchers');
      return reply.status(500).send({ success: false, error: 'Could not fetch batch vouchers' });
    }
  });

  // 3. POST /api/vouchers/generate - Generate a new batch of vouchers
  fastify.post('/vouchers/generate', async (req, reply) => {
    try {
      const body = generateBatchSchema.parse(req.body);

      // Verify plan exists
      const plan = await prisma.plan.findUnique({
        where: { id: body.planId },
      });
      if (!plan) {
        return reply.status(404).send({ success: false, error: 'Plan does not exist' });
      }

      // Fetch or use default admin user as createdBy
      const superadmin = await prisma.user.findFirst();
      if (!superadmin) {
        return reply.status(400).send({ success: false, error: 'No administrative user found' });
      }

      // Create batch
      const batch = await prisma.voucherBatch.create({
        data: {
          name: body.batchName,
          planId: plan.id,
          locationId: body.locationId || plan.locationId,
          quantity: body.quantity,
          createdBy: superadmin.id,
        },
      });

      // Generate unique voucher codes
      const generatedCodes = new Set<string>();
      while (generatedCodes.size < body.quantity) {
        generatedCodes.add(generateVoucherCode());
      }

      const voucherData = Array.from(generatedCodes).map((code) => ({
        code,
        batchId: batch.id,
        planId: plan.id,
        status: VoucherStatus.AVAILABLE,
      }));

      await prisma.voucher.createMany({
        data: voucherData,
      });

      return reply.status(201).send({
        success: true,
        message: `Generated ${body.quantity} vouchers in batch "${batch.name}"`,
        data: {
          batchId: batch.id,
          name: batch.name,
          quantity: body.quantity,
          planName: plan.name,
          sampleCodes: Array.from(generatedCodes).slice(0, 5),
        },
      });
    } catch (err: any) {
      fastify.log.error(err, 'Failed to generate voucher batch');
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to generate vouchers',
      });
    }
  });

  // 4. POST /api/vouchers/redeem - Redeem voucher from Captive Portal
  fastify.post('/vouchers/redeem', async (req, reply) => {
    try {
      const body = redeemVoucherSchema.parse(req.body);
      // Clean and normalize code: e.g. "7x9k-4m2p" -> "7X9K-4M2P"
      let cleanCode = body.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleanCode.length === 8) {
        cleanCode = `${cleanCode.slice(0, 4)}-${cleanCode.slice(4, 8)}`;
      }

      const voucher = await prisma.voucher.findFirst({
        where: {
          code: {
            in: [cleanCode, body.code.trim().toUpperCase()],
          },
        },
        include: { plan: true },
      });

      if (!voucher) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid voucher code. Please check your card and try again.',
        });
      }

      if (voucher.status === VoucherStatus.USED) {
        return reply.status(400).send({
          success: false,
          error: 'This voucher has already been used.',
        });
      }

      if (voucher.status !== VoucherStatus.AVAILABLE) {
        return reply.status(400).send({
          success: false,
          error: `Voucher is not active (${voucher.status}).`,
        });
      }

      const clientMac = body.macAddress || 'GUEST-MAC';
      const now = new Date();
      const plan = voucher.plan;

      // Compute expiration
      let expiresAt: Date | null = null;
      if (plan.durationSec) {
        expiresAt = new Date(now.getTime() + plan.durationSec * 1000);
      }

      // Find or create customer
      let customer = await prisma.customer.findFirst({
        where: { phoneNumber: 'GUEST-VOUCHER' },
      });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            phoneNumber: 'GUEST-VOUCHER',
            name: 'Voucher Guest User',
            isGuest: true,
          },
        });
      }

      // Create Entitlement
      const entitlement = await prisma.entitlement.create({
        data: {
          customerId: customer.id,
          planId: plan.id,
          voucherId: voucher.id,
          status: EntitlementStatus.ACTIVE,
          startsAt: now,
          expiresAt: expiresAt,
          totalBytes: plan.dataLimitBytes ?? null,
          usedBytes: BigInt(0),
          maxDevices: plan.maxDevices,
        },
      });

      // Update Voucher status
      await prisma.voucher.update({
        where: { id: voucher.id },
        data: {
          status: VoucherStatus.USED,
          activatedAt: now,
          claimedBy: customer.id,
          claimedMac: clientMac,
          expiresAt,
        },
      });

      // Populate FreeRADIUS radcheck so router authenticates device MAC or voucher code
      if (clientMac && clientMac !== 'GUEST-MAC') {
        const cleanMac = clientMac.replace(/[:-]/g, '').toUpperCase();
        // Add MAC authentication check
        const existingRad = await prisma.radCheck.findFirst({
          where: { username: cleanMac },
        });
        if (!existingRad) {
          await prisma.radCheck.create({
            data: {
              username: cleanMac,
              attribute: 'Cleartext-Password',
              op: ':=',
              value: cleanMac,
            },
          });
        }
      }

      return reply.send({
        success: true,
        message: `Voucher activated successfully! Enjoy ${plan.name}.`,
        data: {
          planName: plan.name,
          durationSec: plan.durationSec,
          expiresAt: expiresAt?.toISOString() || null,
          downloadSpeedMbps: Math.round(plan.downloadSpeed / 1024),
          entitlementId: entitlement.id,
        },
      });
    } catch (err: any) {
      fastify.log.error(err, 'Voucher redemption failed');
      return reply.status(500).send({
        success: false,
        error: err.message || 'Voucher redemption failed. Please try again.',
      });
    }
  });
}
