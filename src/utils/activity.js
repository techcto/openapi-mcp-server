import { randomUUID } from 'node:crypto';

/** Runtime activity is metadata only: never log bearer tokens, arguments or results. */
export function activity(event, fields = {}) {
  const row = { type: 'mcp.activity', at: new Date().toISOString(), event };
  for (const key of ['request_id', 'method', 'tool', 'transport', 'status', 'duration_ms']) {
    const value = fields[key];
    if (key === 'duration_ms' && Number.isFinite(value)) row[key] = Math.max(0, Math.round(value));
    else if (typeof value === 'string' && /^[A-Za-z0-9_.\/-]{1,100}$/.test(value)) row[key] = value;
  }
  console.log(JSON.stringify(row));
}

export function trackRequest(req, res, toolMap, transport) {
  const started = performance.now();
  const id = randomUUID();
  const methods = ['initialize', 'tools/list', 'tools/call', 'resources/list', 'resources/read', 'resources/subscribe', 'resources/unsubscribe', 'prompts/list', 'prompts/get', 'notifications/initialized', 'ping'];
  const method = methods.includes(req.body?.method) ? req.body.method : 'unknown';
  const name = req.body?.params?.name;
  const tool = typeof name === 'string' && typeof toolMap?.has === 'function' && toolMap.has(name) ? name : undefined;
  const fields = { request_id: id, method, tool, transport };
  activity('request', fields);
  res.once('finish', () => activity('response', { ...fields, status: String(res.statusCode), duration_ms: performance.now() - started }));
}
