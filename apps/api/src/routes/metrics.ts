import { FastifyInstance } from 'fastify';
import { prisma, PaymentStatus, SessionStatus } from '@wifi-billing/database';

export async function metricsRoutes(fastify: FastifyInstance) {
  // GET /api/metrics - Real dynamic system metrics for Admin Dashboard
  fastify.get('/metrics', async (_req, reply) => {
    try {
      // 1. Calculate Today's Revenue (midnight to now)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayPayments = await prisma.payment.findMany({
        where: {
          status: PaymentStatus.SUCCESS,
          settledAt: { gte: startOfDay },
        },
        select: { amount: true },
      });

      const todayRevenue = todayPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      // 2. Active Devices / Online Hotspot Sessions
      const activeSessionsCount = await prisma.session.count({
        where: { status: SessionStatus.ONLINE },
      });

      // 3. Online Managed Routers
      const onlineRoutersCount = await prisma.router.count({
        where: { isActive: true },
      });

      // 4. Active Bandwidth Packages
      const totalPlansCount = await prisma.plan.count({
        where: { isActive: true },
      });

      // 5. Total Vouchers stats
      const totalVouchersCount = await prisma.voucher.count();
      const availableVouchersCount = await prisma.voucher.count({
        where: { status: 'AVAILABLE' },
      });

      // 6. Recent 7-Day Revenue Trend
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const weekPayments = await prisma.payment.findMany({
        where: {
          status: PaymentStatus.SUCCESS,
          settledAt: { gte: sevenDaysAgo },
        },
        select: { amount: true, settledAt: true },
      });

      const weekRevenue = weekPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      return reply.send({
        success: true,
        data: {
          todayRevenue,
          weekRevenue,
          activeDevices: activeSessionsCount,
          onlineRouters: onlineRoutersCount,
          totalPlans: totalPlansCount,
          totalVouchers: totalVouchersCount,
          availableVouchers: availableVouchersCount,
          currency: 'KES',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      fastify.log.error(err, 'Failed to aggregate system metrics');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve system metrics',
      });
    }
  });
}
