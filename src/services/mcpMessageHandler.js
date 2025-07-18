import { CONFIG, getSchemaPath } from '../config/config.js';
import { getToolsArray, getTool, parseToolArguments, executeTool } from '../utils/toolUtils.js';

/**
 * Handle MCP message processing
 */
export const processMcpMessage = async (message, toolMap) => {
  let response;

  switch (message.method) {
    case "initialize":
      response = {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: CONFIG.mcp.protocolVersion,
          capabilities: CONFIG.mcp.capabilities,
          serverInfo: {
            name: CONFIG.server.name,
            version: CONFIG.server.version
          }
        }
      };
      break;

    case "tools/list":
      const tools = getToolsArray(toolMap);
      console.log(`📋 Found ${tools.length} tools`);

      response = {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          tools: tools
        }
      };
      break;

    case "tools/call":
      response = await handleToolCall(message, toolMap);
      break;

    case "notifications/initialized":
      return { status: "acknowledged" };

    case "prompts/list":
      response = {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          prompts: []
        }
      };
      break;

    case "resources/list":
      response = {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          resources: []
        }
      };
      break;

    case "resources/templates/list":
      response = {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          resourceTemplates: []
        }
      };
      break;

    default:
      response = {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32601,
          message: `Method not found: ${message.method}`
        }
      };
  }

  return response;
};

/**
 * Handle tool call specifically
 */
const handleToolCall = async (message, toolMap) => {
  const { name, arguments: args = {} } = message.params || {};
  const tool = getTool(toolMap, name);

  if (!tool) {
    return {
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: -32601,
        message: `Tool '${name}' not found`
      }
    };
  }

  console.log(`🔍 Calling tool '${name}'`);

  try {
    const schemaPath = getSchemaPath(args);
    const parsed = parseToolArguments(tool, args, schemaPath);
    const execution = await executeTool(tool, parsed);

    if (execution.success) {
      return {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          content: [
            {
              type: "text",
              text: execution.result
            }
          ]
        }
      };
    } else {
      throw execution.error;
    }
  } catch (err) {
    console.error("Tool execution error:", err);
    return {
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: -32603,
        message: err.message || "Tool execution failed",
        data: err.stack
      }
    };
  }
};

/**
 * Create error response
 */
export const createErrorResponse = (id, code, message, data = null) => {
  return {
    jsonrpc: "2.0",
    id: id || null,
    error: {
      code,
      message,
      ...(data && { data })
    }
  };
};

/**
 * Handle Zod validation errors specifically
 */
export const handleValidationError = (err, id) => {
  if (err.name === "ZodError") {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32602,
        message: "Invalid params",
        data: err.errors
      }
    };
  }
  return null;
};