import { ListToolsRequestSchema, CallToolRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getToolsArray } from '../utils/toolUtils.js';
import { processMcpMessage } from '../services/mcpMessageHandler.js';
import { trackRequest } from "../utils/activity.js";
// setupMCP.js
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

/**
 * Registers the MCP streamable HTTP endpoint.
 *
 * sessionIdGenerator is explicitly undefined to run in stateless mode:
 * Bedrock AgentCore Runtime requires stateless streamable-HTTP MCP servers
 * and auto-injects its own Mcp-Session-Id header per invocation, so this
 * transport must not try to mint or validate its own session IDs.
 */
export const setupMCP = (app, toolMap, mcpServer) => {
  if (!mcpServer) {
    throw new Error("setupMCP requires an MCP server instance");
  }

  // The SDK's default registry is static. Resolve discovery and calls through the
  // same request-scoped CMS policy used by SSE and legacy transports.
  if (process.env.CMS_MCP_POLICY_URL) {
    mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getToolsArray(toolMap) }));
    mcpServer.server.setRequestHandler(CallToolRequestSchema, async request => {
      const response = await processMcpMessage({ ...request, id: 0 }, toolMap);
      if (response.error) throw new McpError(response.error.code, response.error.message);
      return response.result;
    });
  }
  app.post("/mcp", async (req, res) => {
    trackRequest(req, res, toolMap, "streamable-http");
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        transport.close();
      });
    } catch (err) {
      console.error("❌ Failed to handle MCP request");
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", (req, res) => {
    res.writeHead(405).end(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }));
  });

  app.delete("/mcp", (req, res) => {
    res.writeHead(405).end(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }));
  });
};
