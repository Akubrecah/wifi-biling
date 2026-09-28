import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../index.js';

describe('API Health & System Status Tests', async () => {
  const app = await buildApp();

  after(async () => {
    await app.close();
  });

  it('GET /health should return 200 OK with uptime and timestamp', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.uptime, 'number');
    assert.ok(body.timestamp);
  });

  it('GET /api/health should also return 200 OK under /api prefix', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.status, 'ok');
  });

  it('should return 404 for unknown route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/unknown-route-endpoint',
    });

    assert.equal(response.statusCode, 404);
  });
});
