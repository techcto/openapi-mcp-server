import yaml from "js-yaml";
import { z } from "zod";
import { wrapTool } from "./wrapTool.js";
import { logger } from "../utils/logger.js";

const toYaml = (obj) => yaml.dump(obj, { lineWidth: 100, noRefs: true });

// HTTP execution helper
async function executeRequest(baseUrl, path, method, options = {}) {
  const url = `${baseUrl}${path}`;
  const {
    params = {},
    headers = {},
    bearerToken
  } = options;
  console.log("🐛 bearerToken seen in executeRequest:", bearerToken);

  const body = options.body ?? {};

  // Default to application/json
  const finalHeaders = {
    'Content-Type': 'application/json',
    ...headers
  };

  if (bearerToken && typeof bearerToken === 'string') {
    finalHeaders['Authorization'] = `Bearer ${bearerToken}`;
    console.log("✅ Attached Authorization header");
  } else {
    console.warn("⚠️ No bearerToken provided to attach Authorization header");
  }

  logger.debug("🧪 Raw tool params:", params);
  logger.debug("real args:", params.arguments);
  logger.debug("🔍 param keys:", Object.keys(params));
  logger.debug("🔍 param.entries():");

  for (const [key, value] of Object.entries(params)) {
    logger.debug(`   ${key}: (${typeof value})`, value);
  }

  // Append query params for GET
  let finalUrl = url;
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });
    finalUrl = `${url}?${searchParams.toString()}`;
  }

  const fetchOptions = {
    method: method.toUpperCase(),
    headers: finalHeaders
  };

  // Attach JSON body for non-GET
  if (body && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  try {
    console.log(`📡 ${method.toUpperCase()} ${finalUrl}`);
    console.log(`🧾 Headers:`, finalHeaders);
    console.log(`📦 Payload:`, fetchOptions.body);

    const response = await fetch(finalUrl, fetchOptions);
    const responseText = await response.text();

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      success: response.ok
    };
  } catch (error) {
    return {
      status: 0,
      statusText: 'Network Error',
      error: error.message,
      success: false
    };
  }
}

// Dynamically generate CRUD operation schemas based on OpenAPI spec
function generateOperationSchema(operation, pathParams = [], openApiDoc) {
  const schema = {};

  // --- 1. Path parameters ---
  pathParams.forEach(param => {
    const pathParam = operation.parameters?.find(p => p.name === param.name && p.in === 'path');
    const paramType = pathParam?.schema?.type || 'string';
    const zodType = paramType === 'integer' || paramType === 'number' ? z.number() : z.string();
    const description = `Path parameter: ${param.name}`;
    schema[param.name] = param.required
      ? zodType.describe(description)
      : zodType.optional().describe(`Optional ${description.toLowerCase()}`);
  });

  // --- 2. Query parameters ---
  operation.parameters?.forEach(param => {
    if (param.in === 'query') {
      const type = param.schema?.type || 'string';
      const zodType = (type === 'integer' || type === 'number') ? z.number() : z.string();
      const description = param.description || `Query parameter: ${param.name}`;
      const base = applyEnumAndDefault(zodType, param.schema);
      schema[param.name] = param.required
        ? base.describe(description)
        : base.optional().describe(description);
    }
  });

  // --- 3. Swagger 2.x formData support ---
  operation.parameters?.forEach(param => {
    if (param.in === 'formData') {
      const type = param.schema?.type || 'string';
      const zodType = (type === 'integer' || type === 'number') ? z.number() : z.string();
      const description = param.description || `Form field: ${param.name}`;
      const base = applyEnumAndDefault(zodType, param.schema);
      schema[param.name] = param.required
        ? base.describe(description)
        : base.optional().describe(description);
    }
  });

  // --- 4. OpenAPI 3.x requestBody (x-www-form-urlencoded OR json) ---
  const contentTypes = [
    'application/x-www-form-urlencoded',
    'application/json'
  ];

  for (const contentType of contentTypes) {
    const content = operation.requestBody?.content?.[contentType];
    const contentSchema = content?.schema;

    if (contentSchema?.type === 'object' && contentSchema.properties) {
      const requiredFields = contentSchema.required || [];

      for (const [key, propSchema] of Object.entries(contentSchema.properties)) {
        if (schema[key]) continue; // Avoid overwriting already defined fields
        const type = propSchema.type || 'string';
        const description = propSchema.description || `Field: ${key}`;
        const zodType = (type === 'integer' || type === 'number') ? z.number() : z.string();
        const base = applyEnumAndDefault(zodType, propSchema);
        schema[key] = requiredFields.includes(key)
          ? base.describe(description)
          : base.optional().describe(description);
      }
    }
  }

  return z.object(schema).passthrough(); // Allow additional properties like bearerToken
}

// --- Helper to apply `enum` and `default` ---
function applyEnumAndDefault(zodType, schema = {}) {
  if (!schema) return zodType;

  if (schema.enum && Array.isArray(schema.enum)) {
    zodType = z.enum(schema.enum.map(String));
  }

  if (schema.default !== undefined) {
    zodType = zodType.default(schema.default);
  }

  return zodType;
}

export async function registerActions(server, loadSchema, toolMap = new Map(), config = {}) {
  console.log("🚀 Registering HTTP execution actions...");

  // Support both environment variables and passed-in config
  const defaultConfig = {
    openapiSchemaPath: config.openapiSchemaPath || process.env.OPENAPI_URL,
    apiBaseUrl: config.apiBaseUrl || process.env.API_BASE_URL,
    ...config
  };

  // Load the OpenAPI spec to generate dynamic tools
  let openApiDoc;
  try {
    openApiDoc = await loadSchema(defaultConfig.openapiSchemaPath);
    console.log(`✅ Successfully loaded OpenAPI schema for actions`);
  } catch (error) {
    console.error(`❌ Failed to load OpenAPI schema for actions`);
    console.error('Error:', error.message);
    console.log('💡 Skipping action registration - only schema tools will be available');
    return toolMap;
  }

  // Extract base URL from OpenAPI spec servers section or config
  const getBaseUrl = () => {
    if (defaultConfig.apiBaseUrl) {
      return defaultConfig.apiBaseUrl;
    }
    if (openApiDoc.servers && openApiDoc.servers.length > 0) {
      return openApiDoc.servers[0].url;
    }
    return 'http://localhost/api'; // Last resort fallback
  };

  const defaultBaseUrl = getBaseUrl();
  console.log(`🌐 Using base URL: ${defaultBaseUrl}`);

  const executionTools = [];

  // Add a generic execute-request tool (the core engine)
  executionTools.push(wrapTool({
    name: "execute-request",
    description: "Execute any HTTP request to the API. Use this for exploring or custom requests.",
    schema: z.object({
      path: z.string().describe("API path (e.g., /asset_category or /asset_category/123)"),
      method: z.string().describe("HTTP method: GET, POST, PUT, DELETE"),
      params: z.record(z.any()).optional().describe("Query parameters for GET requests"),
      body: z.record(z.any()).optional().describe("Form data for POST/PUT requests"),
      headers: z.record(z.string()).optional().describe("Additional HTTP headers")
    }).passthrough(), // Allow additional properties like bearerToken
    handler: async (args) => {
      const { path, method, params, body, headers, bearerToken } = args;
      const finalBaseUrl = defaultBaseUrl;
      const finalBearerToken = bearerToken || process.env.API_KEY;

      console.log(`🔥 Executing: ${method.toUpperCase()} ${finalBaseUrl}${path}`);
      const result = await executeRequest(finalBaseUrl, path, method, {
        params: method.toLowerCase() === 'get' ? params : undefined,
        body: method.toLowerCase() !== 'get' ? body : undefined,
        bearerToken: finalBearerToken,
        headers
      });
      return { content: [{ type: "text", text: toYaml(result) }] };
    }
  }));

  const totalPaths = Object.keys(openApiDoc.paths || {}).length;
  console.log(`🔄 Generating tools for ${totalPaths} API paths...`);

  // Generate specific tools for common operations (convenience wrappers)
  const generatedToolNames = new Set(); // Track generated tool names to avoid duplicates
  let toolsGenerated = 0;

  for (const [path, pathItem] of Object.entries(openApiDoc.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) continue;

      // Extract path parameters dynamically
      const pathParams = [];
      const pathParamRegex = /\{([^}]+)\}/g;
      let match;
      while ((match = pathParamRegex.exec(path)) !== null) {
        pathParams.push({ name: match[1], required: true });
      }

      // Generate semantic tool names based on the actual path structure
      let toolName;
      const resourceName = path.split('/')[1]; // e.g., "asset_category", "datatable", "user"

      if (method.toLowerCase() === 'get' && pathParams.length === 0) {
        toolName = `search-${resourceName}`;
      } else if (method.toLowerCase() === 'post' && pathParams.length === 0) {
        toolName = `create-${resourceName}`;
      } else if (method.toLowerCase() === 'get' && pathParams.length > 0) {
        toolName = `read-${resourceName}`;
      } else if (method.toLowerCase() === 'post' && pathParams.length > 0) {
        toolName = `update-${resourceName}`;
      } else if (method.toLowerCase() === 'put' && pathParams.length > 0) {
        toolName = `update-${resourceName}-put`; // Distinguish PUT from POST updates
      } else if (method.toLowerCase() === 'patch' && pathParams.length > 0) {
        toolName = `patch-${resourceName}`;
      } else if (method.toLowerCase() === 'delete') {
        toolName = `delete-${resourceName}`;
      } else {
        continue; // Skip non-standard operations
      }

      // Check for duplicates and make unique if necessary
      if (generatedToolNames.has(toolName)) {
        toolName = `${toolName}-${method.toLowerCase()}`;
      }

      // Skip if still duplicate (shouldn't happen, but safety check)
      if (generatedToolNames.has(toolName)) {
        continue;
      }

      generatedToolNames.add(toolName);
      toolsGenerated++;

      // Progress indicator every 20 tools instead of logging each one
      if (toolsGenerated % 20 === 0) {
        console.log(`📦 Generated ${toolsGenerated} tools so far...`);
      }

      // Generate operation description from the schema
      const opDescription = operation.summary || operation.description || `${toolName.replace(/-/g, ' ')}`;

      executionTools.push(wrapTool({
        name: toolName,
        description: `${opDescription} (convenience wrapper for execute-request)`,
        schema: generateOperationSchema(operation, pathParams, openApiDoc),
        handler: async (args) => {
          // Use args directly - the registration loop now extracts them correctly
          console.error(`[🔍 DEBUG] ${toolName} called with args:`, JSON.stringify(args, null, 2));

          const {
            headers: extraHeaders = {},
            params: explicitParams,
            bearerToken,
            Authorization,
            ...rest
          } = args;
          const finalBaseUrl = defaultBaseUrl;
          const finalBearerToken =
            bearerToken ||
            (typeof Authorization === 'string' && Authorization.startsWith('Bearer ')
              ? Authorization.slice(7)
              : undefined) ||
            process.env.API_KEY;

          // Replace path parameters
          let actualPath = path;
          pathParams.forEach(param => {
            if (args[param.name] !== undefined) {
              actualPath = actualPath.replace(`{${param.name}}`, encodeURIComponent(args[param.name]));
            }
          });

          const methodLower = method.toLowerCase();
          console.log(`🚀 ${toolName}: ${method.toUpperCase()} ${finalBaseUrl}${actualPath}`);

          const headers = {
            'Content-Type': 'application/json',
            ...extraHeaders
          };
          const contentType = headers['Content-Type'];

          const params = explicitParams || (methodLower === 'get' ? rest : undefined);

          let body = undefined;
          if (methodLower !== 'get') {
            // Filter out non-body parameters from rest for the request body
            const bodyData = { ...rest };
            // Remove path parameters from body data
            pathParams.forEach(param => {
              delete bodyData[param.name];
            });

            if (contentType === 'application/x-www-form-urlencoded') {
              body = new URLSearchParams(bodyData).toString();
            } else if (contentType === 'application/json') {
              body = JSON.stringify(bodyData);
            } else {
              console.warn(`⚠️ Unsupported Content-Type: ${contentType}. Sending body as-is.`);
              body = bodyData;
            }

            console.log("📦 Sending body:", body);
          }

          const result = await executeRequest(finalBaseUrl, actualPath, method, {
            params,
            body,
            bearerToken: finalBearerToken,
            headers
          });

          return {
            content: [{ type: "text", text: toYaml(result) }],
            _meta: { rawArgs: args }
          };
        }
      }));
    }
  }

  console.log(`🎉 Generated ${executionTools.length} execution tools dynamically!`);

  // Register execution tools with ROBUST parameter extraction
  let registeredCount = 0;
  for (const tool of executionTools) {
    const { name, description, schema, handler } = tool;
    toolMap.set(name, tool);
    registeredCount++;

    // Only log every 25th tool registration instead of each one
    if (registeredCount % 25 === 0) {
      console.log(`✅ Registered ${registeredCount}/${executionTools.length} tools...`);
    }

    console.error(`[DEBUG] Registering tool ${name} with MCP SDK`);

    server.tool(name, description, schema, async (ctx) => {
      try {
        console.log(`🔥 FULL CONTEXT for ${name}:`, JSON.stringify(ctx, null, 2));

        // ✅ Robust multi-transport argument handling with client global storage support
        let args = {};

        // First try client global storage (for new client)
        if (ctx && ctx.requestId && global.mcpStoredArgs) {
          args = global.mcpStoredArgs[ctx.requestId] || {};
          console.error(`[DEBUG] Found stored args for request ${ctx.requestId}:`, JSON.stringify(args, null, 2));
        }

        // Fallback to original working server patterns
        if (Object.keys(args).length === 0) {
          args =
            ctx?.params?.arguments ||  // HTTP or Postman-style
            ctx?.arguments ||          // Claude STDIO sometimes uses this
            ctx?._meta?.rawArgs ||     // fallback injection
            ctx || {};                 // very last fallback
        }

        const result = await handler(args);
        return { ...result, _meta: { rawArgs: args } };
      } catch (error) {
        console.error(`💥 Tool ${name} failed:`, error.message);
        return {
          content: [{ type: "text", text: `❌ ${name} failed: ${error.message}` }],
          isError: true
        };
      }
    });
  }

  console.log(`✅ All ${registeredCount} execution tools registered successfully!`);
  return toolMap;
}