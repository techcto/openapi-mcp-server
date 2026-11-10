import { isToolAllowed } from "../config/config.js";

import { z } from "zod";

// Use Zod's public JSON Schema API so nested records, constraints and optional
// fields match the validators actually executed by the MCP runtime.
const buildInputSchema = (shape = {}) => {
  const { $schema, ...schema } = z.toJSONSchema(z.object(shape).passthrough(), { target: 'draft-7' });
  return schema;
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
