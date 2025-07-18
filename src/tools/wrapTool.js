// wrapTool.js
import { z } from "zod";

/**
 * Wraps a tool with name, schema, description, and handler into MCP-compatible format.
 */
export function wrapTool({ name, description, schema, handler }) {
  if (!name || typeof name !== "string") throw new Error("wrapTool: name is required");
  if (!description || typeof description !== "string") throw new Error("wrapTool: description is required");
  if (!schema || !z.ZodType || typeof schema.parse !== "function") throw new Error("wrapTool: schema must be a zod schema");
  if (!handler || typeof handler !== "function") throw new Error("wrapTool: handler must be a function");

  return {
    name,
    description,
    schema,
    handler,
  };
}
