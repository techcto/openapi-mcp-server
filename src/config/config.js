// Configuration constants and settings
export const CONFIG = {
  server: {
    name: "OpenAPI Schema Server",
    version: "1.0.0",
    description: "Provides OpenAPI schema tools",
    port: process.env.PORT || 8000
  },
  
  mcp: {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {},
      prompts: {},
      resources: {},
      logging: {}
    }
  },

  sse: {
    keepAliveInterval: 30000, // 30 seconds
    connectionTimeout: 2 * 60 * 1000, // 2 minutes
    cleanupInterval: 60000 // 1 minute
  },

  cors: {
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Accept']
  },

  headers: {
    sse: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    }
  }
};

export const getSchemaPath = (args) => {
  return args.openapiSchemaPath || process.env.OPENAPI_URL;
};