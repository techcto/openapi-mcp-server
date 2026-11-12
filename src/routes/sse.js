import { activity, trackRequest } from '../utils/activity.js';
import { CONFIG } from '../config/config.js';
import { connectionManager } from '../services/connectionManager.js';
import { processMcpMessage } from '../services/mcpMessageHandler.js';

// Setup SSE routes (with Claude-compatible auth handling)
export const setupSSE = (app, toolMap) => {
  // Normal SSE endpoint (Claude & Postman)
  const sseHandler = (req, res) => {
    const connectionId = Date.now().toString();

    // Support Claude-style Bearer in path
    const pathToken = req.params?.token;
    const authHeader = req.headers['authorization'] || (pathToken ? `Bearer ${pathToken}` : '');

    if (CONFIG.auth?.requireAuth && !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    activity('connected', { transport: 'sse' });

    // Set SSE headers
    res.writeHead(200, CONFIG.headers.sse);

    // Add connection
    const connection = connectionManager.addConnection(connectionId, res);
    const keepAlive = connectionManager.setupKeepAlive(connectionId);

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      activity('disconnected', { transport: 'sse' });
      clearInterval(keepAlive);
      connectionManager.removeConnection(connectionId);
    };

    req.on('close', cleanup);
    req.on('end', cleanup);
    req.on('error', (err) => {
      console.error(`❌ SSE error (${connectionId}):`, err.message);
      cleanup();
    });
  };

  // Standard: /sse
  app.get('/sse', sseHandler);

  // Claude-style: /mcp/api/v1/u/:token/sse
  app.get('/mcp/api/v1/u/:token/sse', sseHandler);

  // POST fallback for tools/call via HTTP (used by Postman or Claude)
  app.post('/sse', async (req, res) => {
    const message = req.body;
    trackRequest(req, res, toolMap, "sse");

    try {
      const response = await processMcpMessage(message, toolMap);

      res.json(response);
    } catch (err) {
      console.error("❌ Error handling MCP message via POST /sse:");
      res.status(500).json({
        jsonrpc: "2.0",
        id: message?.id || null,
        error: {
          code: -32603,
          message: "Internal error",
          data: err.message
        }
      });
    }
  });
};
