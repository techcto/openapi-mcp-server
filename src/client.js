#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Console } from "node:console";
import { registerTools } from "./tools/registerTools.js";
import { registerActions } from "./tools/registerActions.js";
import { loadSchema } from "./utils/schemaLoader.js";
import { logger } from "./utils/logger.js";
import { CONFIG } from "./config/config.js";

// Intercept stdin to capture raw JSON-RPC messages
let stdinBuffer = '';

// Store original process.stdin.push method to intercept data
const originalPush = process.stdin.push;
global.mcpStoredArgs = {};
let requestCounter = 0;

process.stdin.push = function(chunk, encoding) {
  if (chunk && chunk.toString) {
    const data = chunk.toString();
    try {
      const message = JSON.parse(data.trim());
      if (message.method === 'tools/call' && message.params) {
        const requestId = message.id || ++requestCounter;
        global.mcpStoredArgs[requestId] = message.params.arguments || {};
        console.error(`[DEBUG] Stored args for request ${requestId}:`, global.mcpStoredArgs[requestId]);
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }
  return originalPush.call(this, chunk, encoding);
};

// Use stderr for console output to avoid interfering with STDIO transport
globalThis.console = new Console(process.stderr);

// === COMPREHENSIVE DEBUG LOGGING ===
console.error(`[DEBUG] Starting MCP client with args:`, process.argv);
console.error(`[DEBUG] Environment:`, {
  OPENAPI_URL: process.env.OPENAPI_URL,
  API_BASE_URL: process.env.API_BASE_URL
});

// Monitor process messages
process.on('message', (message) => {
  console.error(`[DEBUG] Process message received:`, JSON.stringify(message, null, 2));
});

// Note: NOT monitoring stdin/stdout as that interferes with MCP protocol

// Monitor uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`[DEBUG] Uncaught exception:`, error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[DEBUG] Unhandled rejection at:`, promise, 'reason:', reason);
});

/**
 * Extract API base URL from OpenAPI schema
 */
async function getApiBaseUrlFromSchema(schemaPath) {
  try {
    console.error(`[DEBUG] Loading OpenAPI schema from: ${schemaPath}`);
    
    // Load the schema using your existing loadSchema utility
    const schema = await loadSchema(schemaPath);
    
    if (!schema) {
      throw new Error("Failed to load OpenAPI schema");
    }
    
    console.error(`[DEBUG] Loaded schema info:`, {
      title: schema.info?.title,
      version: schema.info?.version,
      servers: schema.servers?.length || 0,
      host: schema.host,
      basePath: schema.basePath,
      schemes: schema.schemes
    });
    
    // Try OpenAPI 3.x servers first
    if (schema.servers && schema.servers.length > 0) {
      const server = schema.servers[0]; // Use the first server
      console.error(`[DEBUG] Using OpenAPI 3.x server:`, server);
      return server.url;
    }
    
    // Fall back to OpenAPI 2.x (Swagger) format
    if (schema.host) {
      const scheme = schema.schemes?.[0] || 'https';
      const basePath = schema.basePath || '';
      const baseUrl = `${scheme}://${schema.host}${basePath}`;
      console.error(`[DEBUG] Using OpenAPI 2.x format: ${baseUrl}`);
      return baseUrl;
    }
    
    // If no server info found, return null to use fallback
    console.error(`[DEBUG] No server information found in schema`);
    return null;
    
  } catch (error) {
    console.error(`[DEBUG] Error extracting API URL from schema:`, error.message);
    return null;
  }
}

const server = new McpServer({
  name: CONFIG.server.name,
  version: CONFIG.server.version,
  description: CONFIG.server.description + " (STDIO Transport)",
});

console.error(`[DEBUG] MCP Server created with config:`, {
  name: CONFIG.server.name,
  version: CONFIG.server.version,
  description: CONFIG.server.description + " (STDIO Transport)"
});

try {
  const schemaPath = process.env.OPENAPI_URL || 
                    "http://localhost/public/api/system/swagger.json";

  console.error(`[DEBUG] Schema path:`, schemaPath);

  // Get API base URL from schema first
  const schemaApiUrl = await getApiBaseUrlFromSchema(schemaPath);
  
  const config = {
    openapiSchemaPath: schemaPath,
    // Priority: ENV var > schema URL (no hardcoded fallback)
    apiBaseUrl: process.env.API_BASE_URL || schemaApiUrl
  };

  console.error(`[DEBUG] Final config:`, {
    schemaPath: config.openapiSchemaPath,
    apiBaseUrl: config.apiBaseUrl,
    schemaApiUrl: schemaApiUrl || '(not found in schema)'
  });

  if (!config.apiBaseUrl) {
    throw new Error("Could not determine API base URL from environment, schema, or fallback");
  }

  logger.info("🔧 STDIO Server configuration", {
    schemaPath: config.openapiSchemaPath || "(not set)",
    apiBaseUrl: config.apiBaseUrl || "(not set)",
    source: process.env.API_BASE_URL ? "environment" : (schemaApiUrl ? "schema" : "fallback")
  });

  // Register tools and actions using the EXACT same pattern as the HTTP server
  logger.info("🔧 Registering tools and actions...");
  console.error(`[DEBUG] About to register tools...`);

  // First register the schema tools (same as HTTP server)
  const registrationResult = await registerTools(server, loadSchema, new Map(), config);
  console.error(`[DEBUG] registerTools result:`, typeof registrationResult);

  // Extract toolMap from the result (same as HTTP server)
  let toolMap = registrationResult.toolMap || registrationResult;
  const toolConfig = registrationResult.config || config;
  console.error(`[DEBUG] toolMap size:`, toolMap.size);

  // Then register the HTTP action tools (same as HTTP server)
  try {
    toolMap = await registerActions(server, loadSchema, toolMap, toolConfig);
    console.error(`[DEBUG] registerActions completed, toolMap size:`, toolMap.size);
    logger.info("✅ HTTP actions registered successfully");
  } catch (error) {
    console.error(`[DEBUG] registerActions failed:`, error);
    logger.error("❌ Failed to register HTTP actions", { error: error.message });
    logger.info("💡 Continuing with schema tools only");
  }

  logger.info("🎉 MCP STDIO server initialization complete");

} catch (error) {
  console.error(`[DEBUG] Fatal error during initialization:`, error);
  logger.error("❌ Fatal error during STDIO server initialization", { error: error.message });
  process.exit(1);
}

const transport = new StdioServerTransport();
console.error(`[DEBUG] StdioServerTransport created`);

// Add error handling for the server transport
transport.onclose = () => {
  console.error(`[DEBUG] Transport onclose triggered`);
  logger.info("🔌 STDIO server transport closed");
};

transport.onerror = (error) => {
  console.error(`[DEBUG] Transport onerror triggered:`, error);
  logger.error("❌ STDIO server transport error", { error: error.message });
};

try {
  console.error(`[DEBUG] About to connect server transport...`);
  await server.connect(transport);
  console.error(`[DEBUG] Server connected successfully`);
  logger.info("🔌 MCP STDIO server connected and ready");

  // Keep the server alive
  process.on('SIGINT', () => {
    console.error(`[DEBUG] SIGINT received`);
    logger.info("🛑 Received SIGINT, shutting down STDIO server gracefully");
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.error(`[DEBUG] SIGTERM received`);
    logger.info("🛑 Received SIGTERM, shutting down STDIO server gracefully");
    process.exit(0);
  });

} catch (error) {
  console.error(`[DEBUG] Failed to connect server transport:`, error);
  logger.error("❌ Failed to connect STDIO server transport", { error: error.message });
  process.exit(1);
}