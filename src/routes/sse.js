import { CONFIG } from '../config/config.js';
import { connectionManager } from '../services/connectionManager.js';
import { processMcpMessage, createErrorResponse } from '../services/mcpMessageHandler.js';

// Setup SSE routes
export const setupSSE = (app, toolMap) => {
  // SSE endpoint - this is what Postman connects to
  app.get('/sse', (req, res) => {
    const connectionId = Date.now().toString();

    // Set SSE headers
    res.writeHead(200, CONFIG.headers.sse);

    // Add connection to manager
    const connection = connectionManager.addConnection(connectionId, res);

    // Setup keep-alive
    const keepAlive = connectionManager.setupKeepAlive(connectionId);

    // Cleanup on close, end, or error
    const cleanup = () => {
      clearInterval(keepAlive);
      connectionManager.removeConnection(connectionId);
    };

    req.on('close', cleanup);
    req.on('end', cleanup);
    req.on('error', (err) => {
      console.error(`❌ SSE error (${connectionId}):`, err.message);
      cleanup();
    });
  });

  // POST fallback for tools/call via HTTP (used by Postman JSON-RPC client)
  app.post('/sse', async (req, res) => {
    const message = req.body;
    console.log("📨 Received MCP message via POST /sse:", JSON.stringify(message, null, 2));

    try {
      const response = await processMcpMessage(message, toolMap);
      console.log("📤 Sending response via POST /sse:", JSON.stringify(response, null, 2));
      res.json(response);
    } catch (err) {
      console.error("❌ Error handling MCP message via POST /sse:", err);

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