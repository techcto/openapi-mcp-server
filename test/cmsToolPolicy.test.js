import test from 'node:test';
import assert from 'node:assert/strict';
import { createCmsPolicyReader, runWithCmsPolicy, cmsAllowsTool } from '../src/utils/cmsToolPolicy.js';

test('CMS policy restricts discovery and execution and follows changes without redeployment', async () => {
  let at = 0, data = { enabled: true, allowed_tools: ['read-website'] }, calls = 0;
  const read = createCmsPolicyReader({ url: 'https://cms.example.test/mcp/info', now: () => at, fetcher: async () => { calls++; return { ok: true, text: async () => JSON.stringify(data) }; } });
  const first = await read();
  runWithCmsPolicy(first, () => { assert.equal(cmsAllowsTool('read-website'), true); assert.equal(cmsAllowsTool('create-website'), false); });
  await read(); assert.equal(calls, 1);
  data = { enabled: true, allowed_tools: ['create-website'] }; at = 15001;
  runWithCmsPolicy(await read(), () => { assert.equal(cmsAllowsTool('read-website'), false); assert.equal(cmsAllowsTool('create-website'), true); });
});
test('disabled, malformed and unavailable CMS policies fail closed', async () => {
  for (const data of [{ enabled: false, allowed_tools: ['create-website'] }, { enabled: true }, { enabled: true, allowed_tools: ['*'] }]) {
    const read = createCmsPolicyReader({ url: 'https://cms.example.test/mcp/info', fetcher: async () => ({ ok: true, text: async () => JSON.stringify(data) }) });
    runWithCmsPolicy(await read(), () => assert.equal(cmsAllowsTool('create-website'), false));
  }
  const read = createCmsPolicyReader({ url: 'https://cms.example.test/mcp/info', fetcher: async () => { throw Error('offline'); } });
  runWithCmsPolicy(await read(), () => assert.equal(cmsAllowsTool('read-website'), false));
});
test('concurrent request policies do not leak across requests', async () => {
  await Promise.all(['read-website', 'create-website'].map(name => runWithCmsPolicy({ enabled: true, tools: new Set([name]) }, async () => {
    await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(cmsAllowsTool(name), true); assert.equal(cmsAllowsTool(name === 'read-website' ? 'create-website' : 'read-website'), false);
  })));
  assert.equal(cmsAllowsTool('generic-tool'), true);
});
