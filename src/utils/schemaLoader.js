import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import fetch from "node-fetch";

const schemaCache = new Map();

const parseSchemaText = (text, contentType = '') => {
  if (contentType.includes('yaml') || contentType.includes('yml')) {
    return yaml.load(text);
  }

  try {
    return JSON.parse(text);
  } catch {
    return yaml.load(text);
  }
};

const assertSchema = (parsed, source) => {
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid OpenAPI schema from ${source}`);
  }

  if (!parsed.paths || typeof parsed.paths !== "object") {
    throw new Error(`OpenAPI schema from ${source} is missing paths`);
  }

  return parsed;
};

/**
 * Load OpenAPI schema from a local file or remote URL (YAML or JSON)
 */
export const loadSchema = async (path) => {
  if (!path) throw new Error("loadSchema: Missing schema path");
  if (schemaCache.has(path)) {
    return schemaCache.get(path);
  }

  // Fetch remote schema
  if (path.startsWith("http://") || path.startsWith("https://")) {
    const headers = {};
    if (process.env.API_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.API_TOKEN}`;
    }

    const response = await fetch(path, { headers });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to load remote schema (${response.status} ${response.statusText}): ${body}`);
    }

    const text = await response.text();
    const contentType = response.headers.get("content-type") || '';
    const parsed = assertSchema(parseSchemaText(text, contentType), path);

    console.log("📦 Loaded remote schema keys:", Object.keys(parsed));
    console.log("📦 OpenAPI version:", parsed.openapi || parsed.swagger);
    console.log("📦 Path count:", Object.keys(parsed.paths || {}).length);

    schemaCache.set(path, parsed);
    return parsed;
  }

  // Fallback: local path
  const fullPath = resolve(path);
  const fileContent = readFileSync(fullPath, "utf8");
  const parsed = assertSchema(parseSchemaText(fileContent), fullPath);

  console.log("📦 Loaded local schema keys:", Object.keys(parsed));
  console.log("📦 OpenAPI version:", parsed.openapi || parsed.swagger);
  console.log("📦 Path count:", Object.keys(parsed.paths || {}).length);

  schemaCache.set(path, parsed);
  return parsed;
};
