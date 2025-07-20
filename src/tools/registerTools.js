import yaml from "js-yaml";
import { z } from "zod";
import { wrapTool } from "./wrapTool.js";

const toYaml = (obj) => yaml.dump(obj, { lineWidth: 100, noRefs: true });

export async function registerTools(server, loadSchema, toolMap = new Map(), config = {}) {
  console.log("🔧 Registering schema tools...");

  // Support both environment variables and passed-in config
  const defaultConfig = {
    openapiSchemaPath: config.openapiSchemaPath || process.env.OPENAPI_URL,
    apiBaseUrl: config.apiBaseUrl || process.env.API_BASE_URL,
    ...config
  };

  const tools = [
    wrapTool({
      name: "list-endpoints",
      description: "Lists all API paths and their HTTP methods with summaries, organized by path",
      schema: z.object({}),
      handler: async (args = {}) => {
        const schemaPath = defaultConfig.openapiSchemaPath;
        const openapi = await loadSchema(schemaPath);
        const pathMap = {};
        for (const [path, pathItem] of Object.entries(openapi.paths || {})) {
          const methods = Object.keys(pathItem).filter((key) =>
            ["get", "post", "put", "delete", "patch", "options", "head"].includes(key.toLowerCase())
          );
          pathMap[path] = {};
          for (const method of methods) {
            const operation = pathItem[method];
            pathMap[path][method.toUpperCase()] = operation?.summary || "No summary";
          }
        }
        return { content: [{ type: "text", text: toYaml(pathMap) }] };
      },
    }),

    wrapTool({
      name: "get-endpoint",
      description: "Gets detailed information about a specific API endpoint",
      schema: z.object({
        path: z.string().describe("API path (e.g., /user, /asset_category)"),
        method: z.string().describe("HTTP method (GET, POST, PUT, DELETE)")
      }),
      handler: async (args = {}) => {
        const { path, method } = args;
        const schemaPath = defaultConfig.openapiSchemaPath;
        const openApiDoc = await loadSchema(schemaPath);
        const pathItem = openApiDoc.paths?.[path];
        if (!pathItem) return { content: [{ type: "text", text: `Path ${path} not found` }] };
        const operation = pathItem[method.toLowerCase()];
        if (!operation) return { content: [{ type: "text", text: `Method ${method} not found for path ${path}` }] };
        const endpoint = {
          path,
          method: method.toUpperCase(),
          summary: operation.summary,
          description: operation.description,
          tags: operation.tags,
          parameters: operation.parameters,
          requestBody: operation.requestBody,
          responses: operation.responses,
          security: operation.security,
          deprecated: operation.deprecated,
        };
        return { content: [{ type: "text", text: toYaml(endpoint) }] };
      },
    }),

    wrapTool({
      name: "get-request-body",
      description: "Gets the request body schema for a specific endpoint",
      schema: z.object({
        path: z.string().describe("API path (e.g., /user, /asset_category)"),
        method: z.string().describe("HTTP method (GET, POST, PUT, DELETE)")
      }),
      handler: async (args = {}) => {
        const { path, method } = args;
        const schemaPath = defaultConfig.openapiSchemaPath;
        const openApiDoc = await loadSchema(schemaPath);
        const operation = openApiDoc.paths?.[path]?.[method.toLowerCase()];
        if (!operation) return { content: [{ type: "text", text: `Operation ${method} ${path} not found` }] };
        const requestBody = operation.requestBody;
        if (!requestBody) return { content: [{ type: "text", text: `No request body defined for ${method} ${path}` }] };
        return { content: [{ type: "text", text: toYaml(requestBody) }] };
      },
    }),

    wrapTool({
      name: "get-response-schema",
      description: "Gets the response schema for a specific endpoint, method, and status code",
      schema: z.object({
        path: z.string().describe("API path (e.g., /user, /asset_category)"),
        method: z.string().describe("HTTP method (GET, POST, PUT, DELETE)"),
        statusCode: z.string().default("200").describe("HTTP status code (default: 200)")
      }),
      handler: async (args = {}) => {
        const { path, method, statusCode = "200" } = args;
        const schemaPath = defaultConfig.openapiSchemaPath;
        const openApiDoc = await loadSchema(schemaPath);
        const operation = openApiDoc.paths?.[path]?.[method.toLowerCase()];
        const response = operation?.responses?.[statusCode] || operation?.responses?.default;
        if (!response) return { content: [{ type: "text", text: `Response ${statusCode} not found for ${method} ${path}` }] };
        return { content: [{ type: "text", text: toYaml(response) }] };
      },
    }),

    wrapTool({
      name: "get-path-parameters",
      description: "Gets the parameters for a specific path",
      schema: z.object({
        path: z.string().describe("API path (e.g., /user, /asset_category)"),
        method: z.string().optional().describe("HTTP method (optional - if not provided, shows all methods)")
      }),
      handler: async (args = {}) => {
        const { path, method } = args;
        const schemaPath = defaultConfig.openapiSchemaPath;
        const openApiDoc = await loadSchema(schemaPath);
        const pathItem = openApiDoc.paths?.[path];
        if (!pathItem) return { content: [{ type: "text", text: `Path ${path} not found` }] };
        let parameters = [...(pathItem.parameters || [])];
        if (method) {
          const operation = pathItem[method.toLowerCase()];
          if (operation?.parameters) parameters = [...parameters, ...operation.parameters];
        }
        return parameters.length === 0 ? { content: [{ type: "text", text: `No parameters found for ${method || "all methods of"} ${path}` }] } : { content: [{ type: "text", text: toYaml(parameters) }] };
      },
    }),

    wrapTool({
      name: "list-components",
      description: "Lists all schema components (schemas, parameters, responses, etc.)",
      schema: z.object({}),
      handler: async (args = {}) => {
        const schemaPath = defaultConfig.openapiSchemaPath;
        const openApiDoc = await loadSchema(schemaPath);
        const components = openApiDoc.components || {};
        const result = {};
        for (const [type, items] of Object.entries(components)) {
          if (items && typeof items === "object") {
            result[type] = Object.keys(items);
          }
        }
        return { content: [{ type: "text", text: toYaml(result) }] };
      },
    }),

    wrapTool({
      name: "get-component",
      description: "Gets detailed definition for a specific component",
      schema: z.object({
        type: z.string().describe("Component type (e.g., schemas, securitySchemes)"),
        name: z.string().describe("Component name (e.g., user, asset_category)")
      }),
      handler: async (args = {}) => {
        const type = args.type || args.component_type;
        const name = args.name || args.component_name;
        const schemaPath = defaultConfig.openapiSchemaPath;
        const openApiDoc = await loadSchema(schemaPath);
        const component = openApiDoc.components?.[type]?.[name];
        if (!component) return { content: [{ type: "text", text: `Component ${type}.${name} not found` }] };
        return { content: [{ type: "text", text: toYaml(component) }] };
      },
    }),

    wrapTool({
      name: "list-security-schemes",
      description: "Lists all available security schemes",
      schema: z.object({}),
      handler: async (args = {}) => {
        const schemaPath = defaultConfig.openapiSchemaPath;
        const openApiDoc = await loadSchema(schemaPath);
        const schemes = openApiDoc.components?.securitySchemes || {};
        const result = {};
        for (const [name, scheme] of Object.entries(schemes)) {
          result[name] = {
            type: scheme.type,
            description: scheme.description,
            ...(scheme.type === "oauth2" ? { flows: Object.keys(scheme.flows || {}) } : {}),
            ...(scheme.type === "apiKey" ? { in: scheme.in, name: scheme.name } : {}),
            ...(scheme.type === "http" ? { scheme: scheme.scheme } : {}),
          };
        }
        return Object.keys(result).length === 0 ? { content: [{ type: "text", text: "No security schemes defined in this API" }] } : { content: [{ type: "text", text: toYaml(result) }] };
      },
    }),

    wrapTool({
      name: "search-schema",
      description: "Searches across paths, operations, and schemas",
      schema: z.object({
        pattern: z.string().describe("Search pattern (case-insensitive regex)")
      }),
      handler: async (args = {}) => {
        const { pattern } = args;
        const schemaPath = defaultConfig.openapiSchemaPath;
        const openApiDoc = await loadSchema(schemaPath);
        const searchRegex = new RegExp(pattern, "i");

        const results = {
          paths: [],
          operations: [],
          parameters: [],
          components: [],
          securitySchemes: []
        };

        // Search all API paths and operations
        for (const [path, pathItem] of Object.entries(openApiDoc.paths || {})) {
          if (searchRegex.test(path)) results.paths.push(path);

          for (const method of ["get", "post", "put", "delete", "patch", "options", "head"]) {
            const operation = pathItem[method];
            if (!operation) continue;

            if (
              searchRegex.test(operation.summary || "") ||
              searchRegex.test(operation.description || "") ||
              (operation.tags && operation.tags.some((tag) => searchRegex.test(tag)))
            ) {
              results.operations.push(`${method.toUpperCase()} ${path}`);
            }

            for (const param of operation.parameters || []) {
              if (
                searchRegex.test(param.name || "") ||
                searchRegex.test(param.description || "")
              ) {
                results.parameters.push(`${param.name} (${method.toUpperCase()} ${path})`);
              }
            }
          }
        }

        // Search components (schemas, responses, etc.)
        for (const [type, typeObj] of Object.entries(openApiDoc.components || {})) {
          for (const [name, component] of Object.entries(typeObj || {})) {
            if (
              searchRegex.test(name) ||
              searchRegex.test(component?.description || "")
            ) {
              results.components.push(`${type}.${name}`);
            }
          }
        }

        // Search security schemes
        for (const [name, scheme] of Object.entries(openApiDoc.components?.securitySchemes || {})) {
          if (
            searchRegex.test(name) ||
            searchRegex.test(scheme?.description || "")
          ) {
            results.securitySchemes.push(name);
          }
        }

        // Prune empty categories
        for (const key of Object.keys(results)) {
          if (results[key].length === 0) delete results[key];
        }

        // Return formatted YAML result or fallback
        return Object.keys(results).length === 0
          ? {
            content: [{
              type: "text",
              text: `🔍 No matches found for "${pattern}"`
            }]
          }
          : {
            content: [{
              type: "text",
              text: toYaml(results)
            }]
          };
      }
    })
  ];

  // Register schema tools with ROBUST parameter extraction
  let registeredCount = 0;
  for (const tool of tools) {
    const { name, description, schema, handler } = tool;
    toolMap.set(name, tool);
    registeredCount++;

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

  // Register the prompts-list tool
  server.tool(
    "prompts-list",
    "Suggests useful prompts for this OpenAPI schema",
    z.object({}),
    async (ctx) => {
      try {
        console.log(`🚨 DEBUG: prompts-list called with ctx:`, JSON.stringify(ctx, null, 2));

        // ✅ Robust multi-transport argument handling with client global storage support
        let args = {};

        // First try client global storage (for new client)
        if (ctx && ctx.requestId && global.mcpStoredArgs) {
          args = global.mcpStoredArgs[ctx.requestId] || {};
        }

        // Fallback to original working server patterns
        if (Object.keys(args).length === 0) {
          args =
            ctx?.params?.arguments ||
            ctx?.arguments ||
            ctx?._meta?.rawArgs ||
            ctx || {};
        }

        let openApiDoc;
        try {
          openApiDoc = await loadSchema(defaultConfig.openapiSchemaPath);
        } catch (error) {
          return {
            prompts: [{
              name: "Schema not available",
              description: "OpenAPI schema could not be loaded",
              example: "Please check your OPENAPI_URL environment variable or schema path"
            }]
          };
        }

        const prompts = [];

        for (const [path, pathItem] of Object.entries(openApiDoc.paths || {})) {
          for (const method of Object.keys(pathItem)) {
            const operation = pathItem[method];
            if (!operation || typeof operation !== "object") continue;

            prompts.push({
              name: `${method.toUpperCase()} ${path}`,
              description: `Get details for ${method.toUpperCase()} ${path}`,
              tool: "get-endpoint",
              arguments: { path, method: method.toLowerCase() },
              example: `What does ${method.toUpperCase()} ${path} do?`
            });
          }
        }

        prompts.push(
          {
            name: "List all endpoints",
            description: "Lists all API endpoints and methods",
            tool: "list-endpoints",
            arguments: {},
            example: "What endpoints does this API have?"
          },
          {
            name: "List all components",
            description: "List all OpenAPI schema components",
            tool: "list-components",
            arguments: {},
            example: "Show all schema components"
          }
        );

        return { prompts };

      } catch (error) {
        console.error(`❌ prompts-list tool failed:`, error.message);
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Register debug-params tool
  server.tool(
    "debug-params",
    "Debug what parameters are actually received",
    z.object({}).passthrough(), // Accept any arguments
    async (ctx) => {
      // ✅ Robust multi-transport argument handling with client global storage support
      let args = {};

      // First try client global storage (for new client)
      if (ctx && ctx.requestId && global.mcpStoredArgs) {
        args = global.mcpStoredArgs[ctx.requestId] || {};
      }

      // Fallback to original working server patterns
      if (Object.keys(args).length === 0) {
        args =
          ctx?.params?.arguments ||
          ctx?.arguments ||
          ctx?._meta?.rawArgs ||
          ctx || {};
      }

      console.log("🔥 FULL CONTEXT RECEIVED:", JSON.stringify(ctx, null, 2));
      return {
        content: [{
          type: "text",
          text: `Raw arguments received:\n${JSON.stringify(args, null, 2)}`
        }]
      };
    }
  );

  console.log(`✅ Registered ${tools.length + 2} schema tools successfully!`); // +2 for prompts-list and debug-params
  return { toolMap, config: defaultConfig };
}