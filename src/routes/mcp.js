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

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        transport.close();
      });
    } catch (err) {
      console.error("❌ Failed to handle MCP request", err);
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
