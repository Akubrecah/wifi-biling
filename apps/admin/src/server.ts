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

  // Helper to generate MikroTik redirect login.html
  const getMikrotikLoginHtml = (serverIp = '192.168.8.5', portalPort = 3000) => `<!DOCTYPE html>
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
</html>`;

  // Endpoint for MikroTik /tool fetch (raw text/html)
  app.get('/mikrotik/login.html', async (req, reply) => {
    const hostHeader = req.headers.host || '192.168.8.5:3002';
    const serverIp = hostHeader.split(':')[0] || '192.168.8.5';
    reply.type('text/html').send(getMikrotikLoginHtml(serverIp, 3000));
  });

  // Endpoint for browser 1-click download of login.html
  app.get('/download/login.html', async (req, reply) => {
    const hostHeader = req.headers.host || '192.168.8.5:3002';
    const serverIp = hostHeader.split(':')[0] || '192.168.8.5';
    reply
      .header('Content-Disposition', 'attachment; filename="login.html"')
      .type('text/html')
      .send(getMikrotikLoginHtml(serverIp, 3000));
  });

  // Forward /api requests to API Gateway seamlessly
  app.all('/api/*', async (req, reply) => {
    const apiUrl = process.env['API_URL'] || 'http://localhost:3001';
    const targetUrl = `${apiUrl}${req.url}`;
    try {
      const headers: Record<string, string> = {
        Accept: (req.headers['accept'] as string) || 'application/json',
      };
      let reqBody: string | undefined = undefined;
      if (!['GET', 'HEAD'].includes(req.method) && req.body) {
        headers['Content-Type'] = 'application/json';
        reqBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      const upstreamRes = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: reqBody,
      });
      const data = await upstreamRes.text();
      return reply.status(upstreamRes.status).type('application/json').send(data);
    } catch {
      return reply.status(502).send({ success: false, error: 'API Gateway unreachable' });
    }
  });

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
