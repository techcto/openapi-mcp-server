// setupMCP.js
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

/**
 * Registers the MCP streamable HTTP endpoint
 */
export const setupMCP = (app, toolMap, mcpServer) => {
  app.all("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport(req, res);

    try {
      await mcpServer.connect(transport);
    } catch (err) {
      console.error("❌ Failed to connect streamable HTTP transport", err);
      res.status(500).send("Transport connection failed");
    }
  });
};
