import { CONFIG, getSchemaPath } from '../config/config.js';
import { getToolsArray, getTool, parseToolArguments, executeTool } from '../utils/toolUtils.js';
import { handleValidationError } from '../services/mcpMessageHandler.js';

// API endpoints for tool management and execution
export const setupLegacy = (app, toolMap) => {
  // Initialize endpoint - required by MCP protocol
  app.post("/initialize", async (req, res) => {
    console.log("🔌 MCP Initialize request received");

    res.json({
      protocolVersion: CONFIG.mcp.protocolVersion,
      capabilities: CONFIG.mcp.capabilities,
      serverInfo: {
        name: CONFIG.server.name,
        version: CONFIG.server.version,
      },
    });
  });

  // List tools endpoint - required by MCP protocol
  app.post("/tools/list", async (req, res) => {
    console.log("🔧 MCP Tools list request received");

    try {
      const tools = getToolsArray(toolMap).map(tool => ({
        ...tool,
        inputSchema: tool.inputSchema || {
          type: "object",
          properties: {},
        }
      }));

      res.json({
        tools: tools,
      });
    } catch (err) {
      console.error("❌ Error listing tools:", err);
      res.status(500).json({
        error: {
          code: -1,
          message: err.message || "Failed to list tools",
        },
      });
    }
  });

  // Call tool endpoint - required by MCP protocol
  app.post("/tools/call", async (req, res) => {
    const { name, arguments: args = {} } = req.body;

    console.log("🔧 MCP Tool call request received:");
    console.log("🔧 Tool name:", name);
    console.log("📦 Arguments:", args);

    const tool = getTool(toolMap, name);

    if (!tool) {
      console.warn(`⚠️ Tool '${name}' not found.`);
      return res.status(404).json({
        error: {
          code: -1,
          message: `Tool '${name}' not found.`,
        },
      });
    }

    try {
      const schemaPath = getSchemaPath(args);
      const parsed = parseToolArguments(tool, args, schemaPath);
      
      console.log("✅ Parsed and validated arguments:", parsed);

      const execution = await executeTool(tool, parsed);
      
      if (execution.success) {
        res.json({
          content: [
            {
              type: "text",
              text: execution.result,
            },
          ],
        });
      } else {
        throw execution.error;
      }
    } catch (err) {
      console.error("❌ Error invoking tool:", err);

      // Handle Zod validation errors
      const validationError = handleValidationError(err, null);
      if (validationError) {
        return res.status(400).json({
          error: {
            code: -1,
            message: "Validation failed",
            data: validationError.error.data,
          },
        });
      }

      res.status(500).json({
        error: {
          code: -1,
          message: err.message || "Unknown error",
        },
      });
    }
  });

  // Legacy endpoint for backward compatibility
  app.post("/call-tool", async (req, res) => {
    const { name, arguments: args = {} } = req.body;

    console.log("📥 Legacy tool request:");
    console.log("🔧 Tool name:", name);
    console.log("📦 Raw arguments:", args);

    const tool = getTool(toolMap, name);

    if (!tool) {
      console.warn(`⚠️ Tool '${name}' not found.`);
      return res.status(404).json({ error: `Tool '${name}' not found.` });
    }

    try {
      const schemaPath = getSchemaPath(args);
      const parsed = parseToolArguments(tool, args, schemaPath);
      
      console.log("✅ Parsed and validated arguments:", parsed);

      const execution = await executeTool(tool, parsed);
      
      if (execution.success) {
        // For legacy endpoint, return the raw result
        const result = typeof execution.result === 'string' 
          ? JSON.parse(execution.result) 
          : execution.result;
        res.json(result);
      } else {
        throw execution.error;
      }
    } catch (err) {
      console.error("❌ Error invoking tool:", err);

      // Handle Zod validation errors
      const validationError = handleValidationError(err, null);
      if (validationError) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationError.error.data,
        });
      }

      res.status(500).json({
        error: err.message || "Unknown error",
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    }
  });
};