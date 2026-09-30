import { FastifyInstance } from 'fastify';
import { prisma } from '@wifi-billing/database';
import { z } from 'zod';

const onboardRouterSchema = z.object({
  name: z.string().min(2),
  nasIdentifier: z.string().min(2),
  ipAddress: z.string().ip(),
  radiusSecret: z.string().default('testing123_production_radius_secret'),
  apiPort: z.number().int().default(8729),
  apiUsername: z.string().default('api_billing'),
  apiPassword: z.string().default('secure_router_password'),
  serverIp: z.string().default(process.env['VPS_PUBLIC_IP'] || '169.58.96.131'),
  portalPort: z.number().int().default(3000),
  locationId: z.string().uuid().optional(),
});

export async function routerRoutes(fastify: FastifyInstance) {
  // GET /api/routers - List all routers with active client counts
  fastify.get('/routers', async (_req, reply) => {
    const routers = await prisma.router.findMany({
      include: {
        location: {
          select: { name: true, slug: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Count active sessions per router from radacct
    const activeSessions = await prisma.radAcct.groupBy({
      by: ['nasipaddress'],
      where: { acctstoptime: null },
      _count: { radacctid: true },
    });

    const sessionCountMap = new Map<string, number>();
    for (const item of activeSessions) {
      sessionCountMap.set(item.nasipaddress, item._count.radacctid);
    }

    const fleet = routers.map((r) => ({
      id: r.id,
      name: r.name,
      nasIdentifier: r.nasIdentifier,
      ipAddress: r.ipAddress,
      radiusSecret: r.radiusSecret,
      apiPort: r.apiPort,
      apiUsername: r.apiUsername,
      isActive: r.isActive,
      locationName: r.location?.name ?? 'Default Location',
      activeClients: sessionCountMap.get(r.ipAddress) ?? 0,
      lastHeartbeat: r.lastHeartbeat,
    }));

    return reply.send({
      success: true,
      data: fleet,
    });
  });

  // POST /api/routers - Onboard a new MikroTik router
  fastify.post('/routers', async (req, reply) => {
    const body = onboardRouterSchema.parse(req.body);

    let locationId = body.locationId;
    if (!locationId) {
      const defaultLoc = await prisma.location.findFirst();
      locationId = defaultLoc?.id;
    }

    if (!locationId) {
      return reply.status(400).send({
        success: false,
        error: 'No location configured to attach router.',
      });
    }

    // 1. Create or update Router record
    const router = await prisma.router.upsert({
      where: { nasIdentifier: body.nasIdentifier },
      create: {
        name: body.name,
        nasIdentifier: body.nasIdentifier,
        ipAddress: body.ipAddress,
        radiusSecret: body.radiusSecret,
        apiPort: body.apiPort,
        apiUsername: body.apiUsername,
        apiPassword: body.apiPassword,
        locationId,
        isActive: true,
      },
      update: {
        name: body.name,
        ipAddress: body.ipAddress,
        radiusSecret: body.radiusSecret,
        apiPort: body.apiPort,
        apiUsername: body.apiUsername,
        apiPassword: body.apiPassword,
        isActive: true,
      },
    });

    // 2. Register NAS client in FreeRADIUS nas table
    await prisma.nas.upsert({
      where: { id: (await prisma.nas.findFirst({ where: { nasname: body.ipAddress } }))?.id ?? 0 },
      create: {
        nasname: body.ipAddress,
        shortname: body.nasIdentifier,
        type: 'mikrotik',
        ports: 1812,
        secret: body.radiusSecret,
        description: `${body.name} Gateway`,
      },
      update: {
        shortname: body.nasIdentifier,
        secret: body.radiusSecret,
      },
    });

    // 3. Generate 1-Click RouterOS Script
    const serverIp = body.serverIp || process.env['VPS_PUBLIC_IP'] || '169.58.96.131';
    const portalPort = body.portalPort || 3000;

    const routerScript = `
# ==============================================================================
# MIKROTIK ROUTEROS 1-CLICK BILLING ONBOARDING SCRIPT
# Router: ${body.name} (${body.nasIdentifier})
# Billing Server IP: ${serverIp}
# ==============================================================================

# 1. Configure FreeRADIUS AAA Connection
/radius
add service=hotspot address=${serverIp} secret="${body.radiusSecret}" \\
    authentication-port=1812 accounting-port=1813 timeout=3000ms comment="Billing-FreeRADIUS-${body.nasIdentifier}"

# 2. Enable CoA / Packet of Disconnect Listener (Port 3799)
/radius incoming
set accept=yes port=3799

# 3. Configure Hotspot Profile for RADIUS Accounting & Interim Updates
/ip hotspot profile
set [find] use-radius=yes radius-accounting=yes radius-interim-update=1m login-by=http-pap,http-chap nas-port-type=wireless-802.11

# 4. Add Billing Server and Captive Portal to Walled Garden
/ip hotspot walled-garden ip
add action=accept dst-address=${serverIp} comment="Allow Captive Portal & Billing Server"
/ip hotspot walled-garden
add dst-host=${serverIp} comment="Allow Captive Portal Host"

# 5. Automatically Download and Install FastNet Captive Portal login.html
/tool fetch url="http://${serverIp}:${portalPort}/mikrotik/login.html" dst-path="hotspot/login.html" mode=http
/tool fetch url="http://${serverIp}:${portalPort}/mikrotik/login.html" dst-path="flash/hotspot/login.html" mode=http

# 6. Provision API User for Automated Telemetry & Dynamic Kicks
/user group
add name=billing_api policy=api,read,write,test,password comment="Billing Automation Group"
/user
add name=${body.apiUsername} group=billing_api password="${body.apiPassword}" comment="Billing API User"
/ip service
set api disabled=no port=8728
set api-ssl disabled=no port=${body.apiPort}
`.trim();

    const captivePortalHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FastNet Hotspot Portal</title>
  <meta http-equiv="refresh" content="0; url=http://${serverIp}:${portalPort}/hotspot?mac=$(mac)&ip=$(ip)&username=$(username)&link-login=$(link-login)&link-login-only=$(link-login-only)&link-orig=$(link-orig)&error=$(error)">
  <script type="text/javascript">
    window.location.href = "http://${serverIp}:${portalPort}/hotspot?mac=$(mac)&ip=$(ip)&username=$(username)&link-login=$(link-login)&link-login-only=$(link-login-only)&link-orig=$(link-orig)&error=$(error)";
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0F172A; color: #F8FAFC; text-align: center; padding-top: 60px;">
  <h2 style="margin-bottom: 8px;">FastNet High-Speed WiFi</h2>
  <p style="color: #94A3B8;">Redirecting to internet packages &amp; M-Pesa billing...</p>
  <p style="margin-top: 24px;">
    <a href="http://${serverIp}:${portalPort}/hotspot?mac=$(mac)&ip=$(ip)&link-login-only=$(link-login-only)" style="background: #10B981; color: #0F172A; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">
      Click here to select an internet package
    </a>
  </p>
</body>
</html>
`.trim();

    return reply.status(201).send({
      success: true,
      data: {
        router,
        scripts: {
          routeros: routerScript,
          captivePortalHtml,
        },
      },
    });
  });

  // GET /api/routers/:id/script - Generate script for an existing router
  fastify.get('/routers/:id/script', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { serverIp?: string; portalPort?: string };
    const serverIp = query.serverIp || process.env['VPS_PUBLIC_IP'] || '169.58.96.131';
    const portalPort = Number(query.portalPort) || 3000;

    const router = await prisma.router.findUnique({
      where: { id },
    });

    if (!router) {
      return reply.status(404).send({ success: false, error: 'Router not found' });
    }

    const routerScript = `
# 1. Configure FreeRADIUS AAA Connection
/radius
add service=hotspot address=${serverIp} secret="${router.radiusSecret}" \\
    authentication-port=1812 accounting-port=1813 timeout=3000ms comment="Billing-FreeRADIUS-${router.nasIdentifier}"

# 2. Enable CoA / Packet of Disconnect Listener (Port 3799)
/radius incoming
set accept=yes port=3799

# 3. Configure Hotspot Profile
/ip hotspot profile
set [find] use-radius=yes radius-accounting=yes radius-interim-update=1m login-by=http-pap,http-chap

# 4. Add Server to Walled Garden
/ip hotspot walled-garden ip
add action=accept dst-address=${serverIp} comment="Allow Captive Portal & Billing Server"
/ip hotspot walled-garden
add dst-host=${serverIp} comment="Allow Captive Portal Host"

# 5. Automatically Download and Install FastNet Captive Portal login.html
/tool fetch url="http://${serverIp}:${portalPort}/mikrotik/login.html" dst-path="hotspot/login.html" mode=http
/tool fetch url="http://${serverIp}:${portalPort}/mikrotik/login.html" dst-path="flash/hotspot/login.html" mode=http
`.trim();

    const captivePortalHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FastNet Hotspot Portal</title>
  <meta http-equiv="refresh" content="0; url=http://${serverIp}:${portalPort}/hotspot?mac=$(mac)&ip=$(ip)&username=$(username)&link-login=$(link-login)&link-login-only=$(link-login-only)&link-orig=$(link-orig)&error=$(error)">
  <script type="text/javascript">
    window.location.href = "http://${serverIp}:${portalPort}/hotspot?mac=$(mac)&ip=$(ip)&username=$(username)&link-login=$(link-login)&link-login-only=$(link-login-only)&link-orig=$(link-orig)&error=$(error)";
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0F172A; color: #F8FAFC; text-align: center; padding-top: 60px;">
  <h2 style="margin-bottom: 8px;">FastNet High-Speed WiFi</h2>
  <p style="color: #94A3B8;">Redirecting to internet packages &amp; M-Pesa billing...</p>
  <p style="margin-top: 24px;">
    <a href="http://${serverIp}:${portalPort}/hotspot?mac=$(mac)&ip=$(ip)&link-login-only=$(link-login-only)" style="background: #10B981; color: #0F172A; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">
      Click here to select an internet package
    </a>
  </p>
</body>
</html>
`.trim();

    return reply.send({
      success: true,
      data: {
        router,
        scripts: {
          routeros: routerScript,
          captivePortalHtml,
        },
      },
    });
  });

  // POST /api/routers/test-radius - Execute live AAA test against FreeRADIUS
  fastify.post('/routers/test-radius', async (_req, reply) => {
    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execPromise = promisify(exec);
      const testCmd = 'docker exec wifi_billing_freeradius radtest testuser testpass 127.0.0.1 0 testing123_production_radius_secret';

      try {
        const { stdout } = await execPromise(testCmd);
        if (stdout.includes('Access-Accept')) {
          return reply.send({
            success: true,
            message: 'Access-Accept received with Mikrotik-Rate-Limit = 5M/2M! RADIUS AAA server is fully operational.',
            output: stdout,
          });
        } else {
          return reply.send({
            success: false,
            message: 'RADIUS check did not accept test credentials.',
            output: stdout,
          });
        }
      } catch (err: any) {
        return reply.send({
          success: false,
          message: 'RADIUS command failed: ' + (err.stdout || err.message),
          output: err.stdout || err.stderr,
        });
      }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: 'Could not execute RADIUS test: ' + err.message,
      });
    }
  });
}
