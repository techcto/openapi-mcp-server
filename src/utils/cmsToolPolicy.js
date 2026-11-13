import { AsyncLocalStorage } from 'node:async_hooks';

const context = new AsyncLocalStorage();
export const runWithCmsPolicy = (policy, callback) => context.run(policy, callback);
export const cmsAllowsTool = name => {
  const policy = context.getStore();
  return !policy || (policy.enabled && policy.tools.has(name));
};

// Each service has one configured CMS. Cache only its public policy, never credentials.
export function createCmsPolicyReader({ url = '', fetcher = fetch, now = Date.now, ttl = 15000 } = {}) {
  if (!url) return async () => null;
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/mcp/info') throw new Error('Invalid CMS policy URL');
  let cached, expires = 0, pending;
  return async () => {
    if (cached && now() < expires) return cached;
    if (pending) return pending;
    pending = (async () => {
      let policy = { enabled: false, tools: new Set() };
      try {
        const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('CMS policy unavailable');
        const text = await response.text();
        if (text.length > 262144) throw new Error('CMS policy too large');
        const data = JSON.parse(text);
        if (data.enabled === true && Array.isArray(data.allowed_tools) && data.allowed_tools.every(name => typeof name === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(name))) {
          policy = { enabled: true, tools: new Set(data.allowed_tools) };
        }
      } catch { /* Unavailable or malformed CMS policy grants no tools. */ }
      cached = policy; expires = now() + ttl; return policy;
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}

export function cmsPolicyMiddleware(read) {
  return async (_req, _res, next) => runWithCmsPolicy(await read(), next);
}
