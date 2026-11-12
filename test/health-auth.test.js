import assert from 'node:assert/strict';
import express from 'express';
process.env.REQUIRE_AUTH = 'true';
process.env.MCP_AUTH_TOKEN = 'health-test-token';
const { setupMiddleware } = await import('../src/middleware/index.js');
const app = express();
setupMiddleware(app);
app.get('/protected', (_req, res) => res.json({ ok: true }));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  for (const [path, status] of [['/health', 'healthy'], ['/ping', 'Healthy']]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status });
    assert.equal((await fetch(base + path, { method: 'HEAD' })).status, 200);
    assert.equal((await fetch(base + path, { method: 'POST' })).status, 401);
  }
  for (const path of ['/protected', '/mcp', '/tools/list', '/health/secrets', '/ping/secrets']) {
    assert.equal((await fetch(base + path)).status, 401);
  }
  assert.equal((await fetch(base + '/protected', { headers: { Authorization: 'Bearer health-test-token' } })).status, 200);
  console.log('Liveness is public; application endpoints remain authenticated.');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
