import test from 'node:test';
import assert from 'node:assert/strict';
import { McpClient, runAgent } from '../engine.mjs';
import { signSession, readSession, handler } from '../gateway.mjs';
const id = 'a8516aa9-2f0d-435d-b3a1-c27ff214e187';
test('session signatures bind the conversation to its authenticated subject and expire', () => {
  const token = signSession(id, 'user-one', 'secret', 1000);
  assert.equal(readSession(token, 'user-one', 'secret', 2000), id);
  assert.throws(() => readSession(token, 'user-two', 'secret', 2000));
  assert.throws(() => readSession(token + 'x', 'user-one', 'secret', 2000));
  assert.throws(() => readSession(token, 'user-one', 'secret', 4000000));
});
test('autonomous execution requires both deployment activation and request activation', async () => {
  const mcp = { tools: async () => [] };
  await assert.rejects(runAgent({ prompt: 'Build site', type: 'autonomous', activated: true }, { mcp, allowAutonomous: false }), /not activated/);
  await assert.rejects(runAgent({ prompt: 'Build site', type: 'autonomous' }, { mcp, allowAutonomous: true }), /not activated/);
});
test('chat cannot inherit autonomous write access and model output cannot call hidden tools', async () => {
  const mcp = { allowWrites: true, tools: async () => [{ name: 'read-website', inputSchema: { type: 'object' } }] };
  await assert.rejects(runAgent({ prompt: 'Delete a site', type: 'chat' }, { mcp, allowAutonomous: true, instruction: 'Read only', converse: async () => ({ stopReason: 'tool_use', output: { message: { role: 'assistant', content: [{ toolUse: { name: 'delete-website', toolUseId: 'tool', input: {} } }] } } }) }), /unavailable tool/);
  assert.equal(mcp.allowWrites, false);
});
test('model tool calls feed real CMS results back into the model before returning the answer', async () => {
  let calls = 0;
  const mcp = { tools: async () => [{ name: 'read-website', inputSchema: { type: 'object' } }], call: async (method, args) => { assert.equal(method, 'tools/call'); assert.equal(args.name, 'read-website'); return { content: [{ text: 'Real CMS content' }] }; } };
  const result = await runAgent({ prompt: 'What does the site say?' }, { mcp, modelId: 'model', instruction: 'Use CMS', converse: async input => {
    calls++;
    if (calls === 1) return { stopReason: 'tool_use', output: { message: { role: 'assistant', content: [{ toolUse: { name: 'read-website', toolUseId: 'tool', input: {} } }] } } };
    assert.match(JSON.stringify(input.messages), /Real CMS content/);
    return { stopReason: 'end_turn', output: { message: { role: 'assistant', content: [{ text: 'Answer from the CMS' }] } } };
  } });
  assert.equal(result.text, 'Answer from the CMS'); assert.equal(calls, 2);
});
test('MCP rejects plaintext endpoints rather than sending CMS credentials insecurely', () => {
  assert.throws(() => new McpClient({ url: 'http://cms.example.test/mcp', token: 'secret' }), /HTTPS/);
});
test('gateway rejects anonymous requests by default without invoking AWS', async () => {
  const previous = process.env.PUBLIC_CHAT; delete process.env.PUBLIC_CHAT;
  try { const response = await handler({ headers: {}, requestContext: { http: { method: 'GET' } }, rawPath: '/api/agents/chat' }); assert.equal(response.statusCode, 401); }
  finally { if (previous !== undefined) process.env.PUBLIC_CHAT = previous; }
});
test('Osirus transport initializes once and reads matching SSE without waiting for stream close', async () => {
  const original = globalThis.fetch, methods = [];
  const { McpHttpTransportService } = await import('../mcp-transport.mjs');
  McpHttpTransportService.clearSessions();
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body); methods.push(request.method);
    if (request.method === 'notifications/initialized') return new Response(null, { status: 202 });
    const result = request.method === 'initialize' ? { protocolVersion: '2025-06-18' } : { tools: [{ name: 'read-website', annotations: { readOnlyHint: true } }] };
    const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ jsonrpc: '2.0', id: request.id, result })}\n\n`)); } });
    return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'mcp-session-id': 'session-one' } });
  };
  try {
    const client = new McpClient({ url: 'https://cms.example.test/mcp', token: 'private-fixture' });
    assert.equal((await client.tools()).length, 1); await client.tools();
    assert.deepEqual(methods, ['initialize', 'notifications/initialized', 'tools/list', 'tools/list']);
  } finally { globalThis.fetch = original; McpHttpTransportService.clearSessions(); }
});
test('model usage includes intermediate CMS tool turns, not only the final answer', async () => {
  let turn = 0;
  const result = await runAgent({ prompt: 'Read CMS' }, {
    mcp: { tools: async () => [{ name: 'read-website' }], call: async () => ({ content: [{ text: 'CMS content' }] }) },
    converse: async () => ++turn === 1
      ? { usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 }, stopReason: 'tool_use', output: { message: { role: 'assistant', content: [{ toolUse: { name: 'read-website', toolUseId: 'one' } }] } } }
      : { usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 }, stopReason: 'end_turn', output: { message: { role: 'assistant', content: [{ text: 'Answer' }] } } },
  });
  assert.deepEqual(result.usage, { inputTokens: 30, outputTokens: 8, totalTokens: 38 });
});
test('the real widget metadata and preflight contract work against the AWS gateway', async () => {
  const previous = process.env.PUBLIC_CHAT, origins = process.env.ALLOWED_ORIGINS;
  process.env.PUBLIC_CHAT = 'true'; process.env.ALLOWED_ORIGINS = 'https://site.example.test';
  try {
    const event = { headers: { origin: 'https://site.example.test' }, requestContext: { http: { method: 'GET' } }, rawPath: '/api/agents/chat' };
    const response = await handler(event); assert.equal(response.statusCode, 200); assert.equal(JSON.parse(response.body).agent.is_ai_enabled, true);
    assert.match(response.headers['Access-Control-Allow-Headers'], /X-Agent-Id/);
    assert.equal((await handler({ ...event, headers: { origin: 'https://foreign.example.test' } })).statusCode, 403);
  } finally { if (previous === undefined) delete process.env.PUBLIC_CHAT; else process.env.PUBLIC_CHAT = previous; if (origins === undefined) delete process.env.ALLOWED_ORIGINS; else process.env.ALLOWED_ORIGINS = origins; }
});
