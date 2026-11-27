import { createHmac, timingSafeEqual, randomUUID, createPublicKey, verify } from 'node:crypto';
const secrets = new Map(), jwks = new Map();
async function secret(arn) {
  if (!secrets.has(arn)) {
    const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
    const data = await new SecretsManagerClient({}).send(new GetSecretValueCommand({ SecretId: arn }));
    secrets.set(arn, data.SecretString);
  }
  return secrets.get(arn);
}
export function signSession(id, subject, key, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ id, subject, exp: Math.floor(now / 1000) + 3600 })).toString('base64url');
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}
export function readSession(token, subject, key, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 1500) throw new Error('Invalid session.');
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) throw new Error('Invalid session.');
  const actual = Buffer.from(signature, 'base64url'), expected = createHmac('sha256', key).update(body).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid session.');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.subject !== subject || !Number.isInteger(payload.exp) || payload.exp <= Math.floor(now / 1000) || !/^[a-f0-9-]{36}$/.test(payload.id)) throw new Error('Invalid session.');
  return payload.id;
}
async function identity(headers) {
  const authorization = headers.authorization || '';
  if (!authorization && process.env.PUBLIC_CHAT === 'true') return 'public';
  if (!authorization.startsWith('Bearer ')) throw new Error('Sign in to continue.');
  const token = authorization.slice(7);
  if (token.length > 16000) throw new Error('Invalid token.');
  const [head, body, signature, extra] = token.split('.');
  if (!head || !body || !signature || extra) throw new Error('Invalid token.');
  const header = JSON.parse(Buffer.from(head, 'base64url')), claims = JSON.parse(Buffer.from(body, 'base64url'));
  const issuer = process.env.OIDC_ISSUER, audience = process.env.OIDC_AUDIENCE;
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !issuer?.startsWith('https://') || !audience || claims.iss !== issuer || ![claims.aud].flat().includes(audience) || !Number.isInteger(claims.exp) || claims.exp <= now || (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now + 30)) || typeof claims.sub !== 'string') throw new Error('Invalid token.');
  let cached = jwks.get(issuer);
  if (!cached || cached.expires < Date.now()) {
    const response = await fetch(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Identity provider unavailable.');
    const discovery = await response.json();
    const uri = new URL(discovery.jwks_uri);
    if (discovery.issuer !== issuer || uri.protocol !== 'https:' || uri.origin !== new URL(issuer).origin || uri.username || uri.password) throw new Error('Invalid identity provider.');
    const keys = await fetch(uri, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!keys.ok) throw new Error('Identity provider unavailable.');
    cached = { data: await keys.json(), expires: Date.now() + 300000 }; jwks.set(issuer, cached);
  }
  const key = cached.data.keys?.find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.use || k.use === 'sig') && (!k.alg || k.alg === 'RS256'));
  if (!key || !verify('RSA-SHA256', Buffer.from(`${head}.${body}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(signature, 'base64url'))) throw new Error('Invalid token.');
  return `${issuer}:${claims.sub}`;
}
/** HTTPS wildcard origins cover one subdomain label and never the apex or another domain. */
export function originAllowed(origin, allowed) {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin) return false;
    return allowed.some(entry => {
      if (entry === origin) return true;
      if (!/^https:\/\/\*\.[a-z0-9.-]+(?::[0-9]+)?$/.test(entry)) return false;
      const pattern = new URL(entry.replace('://*.', '://wildcard.'));
      const suffix = pattern.hostname.slice('wildcard'.length);
      const label = url.hostname.endsWith(suffix) ? url.hostname.slice(0, -suffix.length) : '';
      return url.port === pattern.port && label !== '' && !label.includes('.');
    });
  } catch { return false; }
}

export async function handler(event) {
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
  const origin = headers.origin, allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const permitted = origin && originAllowed(origin, allowed);
  const responseHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin', ...(permitted ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Agent-Id', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' } : {}) };
  const respond = (statusCode, body) => ({ statusCode, headers: responseHeaders, body: JSON.stringify(body) });
  if (origin && !permitted) return respond(403, { error: 'Origin is not allowed.' });
  const method = event.requestContext?.http?.method || event.httpMethod, path = event.rawPath || event.path;
  if (method === 'OPTIONS') return respond(204, {});
  let subject;
  try { subject = await identity(headers); } catch { return respond(401, { error: 'Sign in to continue.' }); }
  if (method === 'GET' && path === '/api/agents/chat') return respond(200, { agent: { id: 'chat', name: process.env.AGENT_NAME || 'Solodev Assistant', type: 'chat', status: 'live', is_ai_enabled: true, greeting: 'How can I help?', custom_hex_color: '#006FE5', custom_options: [], show_map: false } });
  if (method === 'GET' && path === '/api/agents/chat/page-narration') return respond(200, { page_narration: { supported: false, supportsTextSummary: false, supportsSpeech: false } });
  const match = /^\/api\/agents\/chat\/chat\/([^/]+)\/messages$/.exec(path || '');
  if (method !== 'POST' || !match) return respond(404, { error: 'Not found.' });
  try {
    const bytes = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : Buffer.from(event.body || '');
    if (bytes.length > 16384) return respond(413, { error: 'Request is too large.' });
    const input = JSON.parse(bytes.toString('utf8'));
    if (typeof input.content !== 'string' || !input.content.trim() || input.content.length > 8000) return respond(400, { error: 'Supply a message of 1–8000 characters.' });
    const key = await secret(process.env.SESSION_SECRET_ARN);
    const id = match[1] === 'new' ? randomUUID() : readSession(decodeURIComponent(match[1]), subject, key);
    // The public widget cannot select tools, activate autonomous work, or substitute a runtime.
    const { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } = await import('@aws-sdk/client-bedrock-agentcore');
    const result = await new BedrockAgentCoreClient({ maxAttempts: 1 }).send(new InvokeAgentRuntimeCommand({ agentRuntimeArn: process.env.RUNTIME_ARN, runtimeSessionId: id, contentType: 'application/json', accept: 'application/json', payload: Buffer.from(JSON.stringify({ prompt: input.content, sessionId: id, type: 'chat' })) }));
    let size = 0, chunks = [];
    for await (const chunk of result.response) { size += chunk.length; if (size > 262144) throw new Error('Response too large.'); chunks.push(chunk); }
    const answer = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof answer.text !== 'string') throw new Error('Invalid response.');
    const chatId = signSession(id, subject, key);
    return respond(200, { chat: { id: chatId, name: 'Chat', updated_at: new Date().toISOString() }, message: { id: randomUUID(), role: 'assistant', content: answer.text, chat_id: chatId, model_slug: 'agentcore' } });
  } catch { return respond(502, { error: 'The agent could not complete this request. Please start a new conversation or retry.' }); }
}
