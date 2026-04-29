const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;

  return fallback;
};

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const port = Number.parseInt(process.env.PORT || '8000', 10) || 8000;
const host = process.env.HOST || '0.0.0.0';
const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
const authTokens = parseCsv(process.env.MCP_AUTH_TOKENS || process.env.MCP_AUTH_TOKEN || process.env.API_TOKEN);
const requireAuth = parseBoolean(process.env.REQUIRE_AUTH, authTokens.length > 0);
const allowedToolNames = parseCsv(process.env.MCP_ALLOWED_TOOLS);
const upstreamBearerToken =
  process.env.API_BEARER_TOKEN ||
  process.env.OPENAPI_AUTH_TOKEN ||
  process.env.API_TOKEN ||
  '';

// Configuration constants and settings
export const CONFIG = {
  server: {
    name: process.env.SERVER_NAME || 'OpenAPI MCP Server',
    version: process.env.SERVER_VERSION || '1.1.0',
    description: process.env.SERVER_DESCRIPTION || 'Provides OpenAPI discovery and execution tools over MCP',
    host,
    port,
    publicBaseUrl,
  },

  auth: {
    requireAuth,
    tokens: authTokens,
  },

  tools: {
    allowedNames: allowedToolNames,
  },

  openapi: {
    schemaPath: process.env.OPENAPI_URL || '',
    apiBaseUrl: process.env.API_BASE_URL || '',
    bearerToken: upstreamBearerToken,
  },

  mcp: {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
      prompts: {},
      resources: {},
      logging: {},
    }
  },

  sse: {
    keepAliveInterval: 30000,
    connectionTimeout: 2 * 60 * 1000,
    cleanupInterval: 60000
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Accept']
  },

  headers: {
    sse: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    }
  }
};

export const getSchemaPath = (args = {}) => {
  return args.openapiSchemaPath || CONFIG.openapi.schemaPath;
};

export const isToolAllowed = (toolName) => {
  if (!toolName) return false;
  if (!CONFIG.tools.allowedNames.length) return true;
  return CONFIG.tools.allowedNames.includes(toolName);
};
