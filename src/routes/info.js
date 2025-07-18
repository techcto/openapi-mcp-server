import { CONFIG } from '../config/config.js';
import { connectionManager } from '../services/connectionManager.js';
import { getToolCount } from '../utils/toolUtils.js';

// Info and health check endpoints
export const setupInfo = (app, toolMap) => {
  // Get server info
  app.get("/", (req, res) => {
    res.json({
      name: CONFIG.server.name,
      version: CONFIG.server.version,
      description: CONFIG.server.description + " via MCP protocol",
      endpoints: {
        mcp: {
          sse: "GET /sse - Server-Sent Events for MCP",
          messages: "POST /mcp - Send MCP JSON-RPC messages"
        },
        legacy: {
          initialize: "POST /initialize",
          listTools: "POST /tools/list",
          callTool: "POST /tools/call",
          callToolLegacy: "POST /call-tool"
        },
        info: {
          health: "GET /health",
          info: "GET /"
        }
      },
      toolCount: getToolCount(toolMap),
      activeConnections: connectionManager.getConnectionCount(),
      usage: {
        postman: `In Postman MCP interface, use: http://localhost:${CONFIG.server.port}/sse`,
        claude: `Use 'sse' transport with URL: http://localhost:${CONFIG.server.port}/sse`
      }
    });
  });

  // Health check
  app.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      toolCount: getToolCount(toolMap),
      activeConnections: connectionManager.getConnectionCount()
    });
  });
};