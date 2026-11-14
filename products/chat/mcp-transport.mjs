// Extracted from Osirus mcp-http-transport.service.ts (72fe8b02). Keep transport contract tests aligned.
import crypto from 'crypto';
const sessions = new Map();
const initializing = new Map();
const SESSION_TTL = 30 * 60 * 1000;
function connectionKey(url, authorization) {
    return crypto.createHash('sha256').update(JSON.stringify([url, authorization])).digest('hex');
}
function matchingResponse(raw, id) {
    try {
        const value = JSON.parse(raw);
        if (String(value?.id) === id)
            return value;
    }
    catch { /* An SSE event is not a JSON document. */ }
    for (const event of raw.split(/\r?\n\r?\n/)) {
        const data = event.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
        try {
            const value = JSON.parse(data);
            if (String(value?.id) === id)
                return value;
        }
        catch { /* Ignore notifications and unrelated events. */ }
    }
    return null;
}
async function readResponse(response, id) {
    if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
        const value = matchingResponse(await response.text(), id);
        if (!value)
            throw new Error('MCP response did not match the request ID.');
        return value;
    }
    // A server may keep SSE open after delivering the response. Stop at our ID,
    // rather than waiting indefinitely for the entire response body to close.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        for (;;) {
            const chunk = await reader.read();
            buffer += decoder.decode(chunk.value, { stream: !chunk.done });
            const value = matchingResponse(buffer, id);
            if (value)
                return value;
            if (buffer.length > 8 * 1024 * 1024)
                throw new Error('MCP response exceeded the transport size limit.');
            if (chunk.done)
                throw new Error('MCP stream ended without a matching response.');
        }
    }
    finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}
export class McpHttpTransportService {
    static clearSessions() { sessions.clear(); }
    static async call(args) {
        const key = connectionKey(args.url, args.authorization);
        const send = async (method, params) => {
            const session = sessions.get(key);
            const notification = method.startsWith('notifications/');
            const id = crypto.randomUUID();
            const response = await fetch(args.url, {
                method: 'POST',
                signal: args.signal || AbortSignal.timeout(30000),
                headers: {
                    'content-type': 'application/json',
                    accept: 'application/json, text/event-stream',
                    ...(args.authorization ? { authorization: args.authorization } : {}),
                    ...(method !== 'initialize' && session?.id ? { 'MCP-Session-Id': session.id } : {}),
                    ...(method !== 'initialize' && session ? { 'MCP-Protocol-Version': session.protocol } : {}),
                },
                body: JSON.stringify({ jsonrpc: '2.0', ...(!notification ? { id } : {}), method, ...(params ? { params } : {}) }),
            });
            if (!response.ok) {
                if (response.status === 404 && session?.id)
                    sessions.delete(key);
                await response.body?.cancel().catch(() => undefined);
                // Do not replay writes: their outcome may be ambiguous.
                throw new Error(`MCP ${method} failed (${response.status}).${response.status === 404 && session?.id ? ' Session expired; reconnect on the next request.' : ''}`);
            }
            if (notification) {
                await response.body?.cancel().catch(() => undefined);
                return null;
            }
            const payload = await readResponse(response, id);
            if (payload.error) {
                const error = Object.assign(new Error(payload.error.message || `MCP ${method} failed.`), { rpcCode: payload.error.code });
                throw error;
            }
            if (method === 'initialize') {
                const protocol = String(payload.result?.protocolVersion || '');
                if (!['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'].includes(protocol)) {
                    throw new Error('MCP server returned an unsupported protocol version.');
                }
                sessions.set(key, { id: response.headers.get('MCP-Session-Id') || undefined, protocol, initialized: false, updatedAt: Date.now() });
            }
            else if (session)
                session.updatedAt = Date.now();
            return payload.result;
        };
        const initialize = async () => {
            try {
                await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'osirus-mcp-tool-registry', version: '1.0.0' } });
                await send('notifications/initialized');
                const session = sessions.get(key);
                if (session)
                    session.initialized = true;
            }
            catch (error) {
                sessions.delete(key);
                // Preserve stateless legacy servers ONLY when they explicitly say that
                // initialization is unsupported. Auth/network/protocol failures surface.
                if (error?.rpcCode !== -32601)
                    throw error;
                sessions.set(key, { protocol: '2024-11-05', initialized: true, updatedAt: Date.now() });
            }
        };
        sessions.forEach((session, entryKey) => {
            if (Date.now() - session.updatedAt > SESSION_TTL)
                sessions.delete(entryKey);
        });
        if (!sessions.get(key)?.initialized) {
            let pending = initializing.get(key);
            if (!pending) {
                pending = initialize().finally(() => initializing.delete(key));
                initializing.set(key, pending);
            }
            await pending;
            if (args.signal?.aborted)
                throw new Error('MCP request was cancelled.');
        }
        return send(args.method, args.params);
    }
}
