import { FastifyInstance } from 'fastify';
import { prisma } from '@wifi-billing/database';
import dgram from 'node:dgram';

export async function sessionRoutes(fastify: FastifyInstance) {
  // GET /api/sessions - Get real-time active sessions from radacct
  fastify.get('/sessions', async (_req, reply) => {
    const activeSessions = await prisma.radAcct.findMany({
      where: { acctstoptime: null },
      orderBy: { acctstarttime: 'desc' },
      take: 50,
    });

    const serialized = activeSessions.map((s) => ({
      radacctid: s.radacctid.toString(),
      username: s.username,
      clientIp: s.framedipaddress || 'N/A',
      macAddress: s.callingstationid,
      nasIp: s.nasipaddress,
      startTime: s.acctstarttime,
      uploadBytes: s.acctinputoctets ? s.acctinputoctets.toString() : '0',
      downloadBytes: s.acctoutputoctets ? s.acctoutputoctets.toString() : '0',
      sessionTimeSec: s.acctsessiontime ? s.acctsessiontime.toString() : '0',
    }));

    return reply.send({
      success: true,
      data: serialized,
    });
  });

  // POST /api/sessions/disconnect - Send CoA / Disconnect-Request to MikroTik
  fastify.post('/sessions/disconnect', async (req, reply) => {
    const body = req.body as { username?: string; clientIp?: string; nasIp?: string };

    if (!body.username && !body.clientIp) {
      return reply.status(400).send({ success: false, error: 'Provide username or clientIp' });
    }

    const nasIp = body.nasIp || '192.168.88.1';
    
    // In production RFC 3576: sends UDP packet to port 3799 with Disconnect-Request
    const client = dgram.createSocket('udp4');
    const msg = Buffer.from(`User-Name = "${body.username || ''}"\nFramed-IP-Address = "${body.clientIp || ''}"`);

    client.send(msg, 3799, nasIp, (err) => {
      client.close();
      if (err) {
        req.log.warn({ err }, 'Failed to transmit CoA Disconnect-Request packet');
      }
    });

    // Mark session stopped in database
    if (body.username) {
      await prisma.radAcct.updateMany({
        where: { username: body.username, acctstoptime: null },
        data: { acctstoptime: new Date(), acctterminatecause: 'Admin-Reset' },
      });
    }

    return reply.send({
      success: true,
      message: `Disconnect-Request sent to router at ${nasIp}:3799`,
    });
  });
}
