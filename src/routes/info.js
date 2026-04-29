import { CONFIG } from '../config/config.js';
import { connectionManager } from '../services/connectionManager.js';
import { getToolCount } from '../utils/toolUtils.js';

export const setupInfo = (app, toolMap) => {
  // MCP server info
  app.get("/", (req, res) => {
    res.json({
      name: CONFIG.server.name,
      version: CONFIG.server.version,
      description: CONFIG.server.description + " via MCP protocol",
      endpoints: {
        mcp: {
          streamableHttp: "POST /mcp - Claude HTTP streamable transport",
          sse: "GET /mcp/api/v1/u/:token/sse - Claude SSE transport",
        },
        legacy: {
          initialize: "POST /initialize - MCP init handshake",
          listTools: "POST /tools/list - List registered tools",
          callTool: "POST /tools/call - Execute a tool by name",
          callToolLegacy: "POST /call-tool - Legacy direct call"
        },
        info: {
          health: "GET /health",
          info: "GET /"
        }
      },
      toolCount: getToolCount(toolMap),
      activeConnections: connectionManager.getConnectionCount?.() ?? "n/a",
      usage: {
        postman: `Use POST: ${CONFIG.server.publicBaseUrl}/call-tool`,
        claude: {
          streamingPreferred: `Use MCP URL: ${CONFIG.server.publicBaseUrl}/mcp/api/v1/u/<token>/sse`,
          fallback: `Or MCP URL: ${CONFIG.server.publicBaseUrl}/mcp`,
        }
      }
    });
  });

  // Health check
  app.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      toolCount: getToolCount(toolMap),
      activeConnections: connectionManager.getConnectionCount?.() ?? "n/a"
    });
  });
};
