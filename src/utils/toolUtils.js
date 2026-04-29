import { isToolAllowed } from "../config/config.js";

// Utility functions for tool management

const mapZodType = (definition = {}) => {
  const typeName = definition.typeName || '';

  switch (typeName) {
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodEnum':
      return { type: 'string', enum: Array.isArray(definition.values) ? definition.values : [] };
    case 'ZodOptional':
    case 'ZodDefault':
      return mapZodType(definition.innerType?._def || definition.type?._def || {});
    default:
      return { type: 'string' };
  }
};

const buildInputSchema = (shape = {}) => {
  const properties = {};
  const required = [];

  for (const [key, field] of Object.entries(shape)) {
    const fieldDef = field?._def || {};
    properties[key] = {
      ...mapZodType(fieldDef),
      description:
        typeof field.description === 'string'
          ? field.description
          : typeof fieldDef.description === 'string'
            ? fieldDef.description
            : `Parameter: ${key}`
    };

    if (fieldDef.defaultValue !== undefined) {
      properties[key].default =
        typeof fieldDef.defaultValue === 'function' ? fieldDef.defaultValue() : fieldDef.defaultValue;
    }

    if (fieldDef.typeName !== 'ZodOptional' && fieldDef.typeName !== 'ZodDefault') {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties: true
  };
};

const normalizeToolResult = (result) => {
  if (result && typeof result === 'object' && Array.isArray(result.content)) {
    return result;
  }

  return {
    content: [
      {
        type: "text",
        text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
      }
    ]
  };
};

/**
 * Get tools array from toolMap (handles both Map and Object)
 */
export const getToolsArray = (toolMap) => {
  let tools = [];
  
  if (toolMap && typeof toolMap.entries === 'function') {
    // toolMap is a Map
    tools = Array.from(toolMap.entries()).map(([name, tool]) => ({
      name: name,
      description: tool.description || `Tool: ${name}`,
      inputSchema: buildInputSchema(tool.schema?.shape || {})
    }));
  } else if (toolMap && typeof toolMap === 'object') {
    // toolMap is an Object
    tools = Object.entries(toolMap).map(([name, tool]) => ({
      name: name,
      description: tool.description || `Tool: ${name}`,
      inputSchema: buildInputSchema(tool.schema?.shape || {})
    }));
  } else {
    console.error("toolMap is not iterable:", typeof toolMap, toolMap);
  }
  
  return tools;
};

/**
 * Get a specific tool from toolMap (handles both Map and Object)
 */
export const getTool = (toolMap, name) => {
  if (toolMap && typeof toolMap.get === 'function') {
    return toolMap.get(name);
  } else if (toolMap && typeof toolMap === 'object') {
    return toolMap[name];
  }
  return null;
};

/**
 * Filter out non-tool objects (ones without handlers)
 */
export const filterValidTools = (toolMap) => {
  let filteredToolMap;
  
  if (toolMap instanceof Map) {
    filteredToolMap = new Map();
    toolMap.forEach((tool, name) => {
      if (tool && typeof tool.handler === 'function' && isToolAllowed(name)) {
        filteredToolMap.set(name, tool);
      }
    });
  } else if (typeof toolMap === 'object' && toolMap !== null) {
    filteredToolMap = {};
    Object.entries(toolMap).forEach(([name, tool]) => {
      if (tool && typeof tool.handler === 'function' && isToolAllowed(name)) {
        filteredToolMap[name] = tool;
      }
    });
  } else {
    filteredToolMap = toolMap;
  }
  
  return filteredToolMap;
};

/**
 * Get tool count from toolMap
 */
export const getToolCount = (toolMap) => {
  if (!toolMap) return 0;
  return typeof toolMap.size === 'number' ? toolMap.size : Object.keys(toolMap).length;
};

/**
 * Parse and validate tool arguments
 */
export const parseToolArguments = (tool, args, schemaPath) => {
  // Handle schema validation - some tools might not have schemas
  let parsed;
  
  if (tool.schema && typeof tool.schema.parse === 'function') {
    parsed = tool.schema.parse({
      ...args,
      openapiSchemaPath: schemaPath,
    });
  } else {
    // If no schema, just pass the args with schemaPath
    parsed = {
      ...args,
      openapiSchemaPath: schemaPath,
    };
    console.log("⚠️ Tool has no schema, using raw arguments");
  }
  
  return parsed;
};

/**
 * Execute a tool with error handling
 */
export const executeTool = async (tool, parsedArgs) => {
  try {
    const result = await Promise.resolve(tool.handler(parsedArgs));
    console.log("✅ Tool executed successfully");
    return {
      success: true,
      result: normalizeToolResult(result)
    };
  } catch (err) {
    console.error("❌ Error invoking tool:", err);
    return {
      success: false,
      error: err
    };
  }
};
