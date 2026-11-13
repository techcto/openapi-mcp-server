import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupMCP } from '../src/routes/mcp.js';
import { setupSSE } from '../src/routes/sse.js';
import { setupLegacy } from '../src/routes/legacy.js';
import { createCmsPolicyReader, cmsPolicyMiddleware } from '../src/utils/cmsToolPolicy.js';

test('CMS policy is enforced on Streamable HTTP, SSE and legacy transports', async () => {
  process.env.CMS_MCP_POLICY_URL = 'https://cms.example.test/mcp/info';
  let policy = { enabled: true, allowed_tools: ['read-website'] }, writes = 0;
  const app = express(); app.use(express.json());
  app.use(cmsPolicyMiddleware(createCmsPolicyReader({ url: process.env.CMS_MCP_POLICY_URL, ttl: 0, fetcher: async () => ({ ok: true, text: async () => JSON.stringify(policy) }) })));
  const server = new McpServer({ name: 'test', version: '1' });
  const map = new Map(['read-website', 'create-websites'].map(name => [name, { name, description: name, schema: z.object({}), handler: async () => { if (name === 'create-websites') writes++; return { content: [{ type: 'text', text: 'ok' }] }; } }]));
  for (const [name, tool] of map) server.registerTool(name, { description: name, inputSchema: {} }, tool.handler);
  setupMCP(app, map, server); setupSSE(app, map); setupLegacy(app, map);
  const http = app.listen(0, '127.0.0.1'); await new Promise(resolve => http.once('listening', resolve));
  async function call(path, method, params) {
    const body = path.startsWith('/tools/') ? params || {} : { jsonrpc: '2.0', id: 1, method, params };
    const r = await fetch(`http://127.0.0.1:${http.address().port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) });
    let text = await r.text(); if (text.startsWith('event:') || text.startsWith('data:')) text = text.split('\n').find(line => line.startsWith('data:')).slice(5);
    return { status: r.status, data: JSON.parse(text) };
  }
  try {
    const listed = await call('/mcp', 'tools/list'); assert.deepEqual(listed.data.result.tools.map(t => t.name), ['read-website']);
    for (const path of ['/mcp', '/sse', '/tools/call']) {
      const r = await call(path, 'tools/call', { name: 'create-websites', arguments: {} }); assert.ok(r.data.error); assert.equal(writes, 0);
    }
    policy = { enabled: true, allowed_tools: ['create-websites'] };
    const allowed = await call('/mcp', 'tools/call', { name: 'create-websites', arguments: {} }); assert.equal(allowed.data.result.content[0].text, 'ok'); assert.equal(writes, 1);
    policy = { enabled: false, allowed_tools: ['create-websites'] };
    const disabled = await call('/mcp', 'tools/list'); assert.deepEqual(disabled.data.result.tools, []);
    const revoked = await call('/mcp', 'tools/call', { name: 'create-websites', arguments: {} }); assert.ok(revoked.data.error); assert.equal(writes, 1);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); await server.close(); delete process.env.CMS_MCP_POLICY_URL; }
});
