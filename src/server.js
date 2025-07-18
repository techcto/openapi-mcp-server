#!/usr/bin/env node
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/registerTools.js";
import { registerActions } from "./tools/registerActions.js";
import { loadSchema } from "./utils/schemaLoader.js";
import { setupSSE } from "./routes/sse.js";
import { setupMCP } from "./routes/mcp.js";
import { setupLegacy } from "./routes/legacy.js";
import { setupInfo } from "./routes/info.js";
import { setupMiddleware } from "./middleware/index.js";
import { CONFIG } from "./config/config.js";
import { filterValidTools, getToolCount } from "./utils/toolUtils.js";
import { logger } from "./utils/logger.js";

const app = express();

// Setup middleware
setupMiddleware(app);

// Initialize MCP server
const mcpServer = new McpServer({
  name: CONFIG.server.name,
  version: CONFIG.server.version,
  description: CONFIG.server.description,
});

// Register all tools and actions
logger.info("🔧 Registering tools and actions...");

try {
  // First register the schema tools
  const registrationResult = await registerTools(mcpServer, loadSchema);

  // Extract toolMap from the result
  let toolMap = registrationResult.toolMap || registrationResult;
  const toolConfig = registrationResult.config || {};

  // Then register the HTTP action tools
  try {
    toolMap = await registerActions(mcpServer, loadSchema, toolMap, toolConfig);
    logger.info("✅ HTTP actions registered successfully");
  } catch (error) {
    logger.error("❌ Failed to register HTTP actions", { error: error.message });
    logger.info("💡 Continuing with schema tools only");
  }

  // Debug: Log the toolMap contents
  logger.debug("🔍 ToolMap debug info", {
    registrationResultType: typeof registrationResult,
    registrationResultKeys: Object.keys(registrationResult),
    toolMapType: typeof toolMap,
    toolMapIsMap: toolMap instanceof Map,
    toolMapKeys: toolMap instanceof Map ? Array.from(toolMap.keys()) :
      typeof toolMap === 'object' ? Object.keys(toolMap) : 'Not iterable'
  });

  // Filter out non-tool objects (ones without handlers)
  const validToolMap = filterValidTools(toolMap);

  // Setup routes
  setupSSE(app, validToolMap);
  setupMCP(app, validToolMap);
  setupLegacy(app, validToolMap);
  setupInfo(app, validToolMap);

  // Start server
  const server = app.listen(CONFIG.server.port, () => {
    logger.serverEvent('start', {
      port: CONFIG.server.port,
      toolCount: getToolCount(validToolMap),
      endpoints: {
        info: `http://localhost:${CONFIG.server.port}`,
        health: `http://localhost:${CONFIG.server.port}/health`,
        sse: `http://localhost:${CONFIG.server.port}/sse`,
        mcp: `http://localhost:${CONFIG.server.port}/mcp`
      }
    });

    console.log(`🚀 MCP server running at http://localhost:${CONFIG.server.port}`);
    console.log(`📋 Available tools: ${getToolCount(validToolMap)}`);
    console.log(`🔗 Server info: http://localhost:${CONFIG.server.port}`);
    console.log(`❤️ Health check: http://localhost:${CONFIG.server.port}/health`);
    console.log(`🌐 SSE endpoint: http://localhost:${CONFIG.server.port}/sse`);
    console.log(`📨 MCP endpoint: http://localhost:${CONFIG.server.port}/mcp`);
    console.log(`\n📝 For Postman MCP interface, use: http://localhost:${CONFIG.server.port}/sse`);
  });

  // Graceful shutdown
  const gracefulShutdown = (signal) => {
    logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
    
    server.close((err) => {
      if (err) {
        logger.error('❌ Error during server shutdown', { error: err.message });
        process.exit(1);
      }
      
      logger.serverEvent('stop', { signal });
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

} catch (error) {
  logger.error("💥 Failed to start server", { 
    error: error.message, 
    stack: error.stack 
  });
  process.exit(1);
}