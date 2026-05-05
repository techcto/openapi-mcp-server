import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import fetch from "node-fetch";

const schemaCache = new Map();
const REMOTE_SCHEMA_MAX_ATTEMPTS = Number.parseInt(process.env.OPENAPI_FETCH_RETRIES || '12', 10) || 12;
const REMOTE_SCHEMA_RETRY_DELAY_MS = Number.parseInt(process.env.OPENAPI_FETCH_RETRY_DELAY_MS || '2000', 10) || 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

    let lastError = null;

    for (let attempt = 1; attempt <= REMOTE_SCHEMA_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(path, { headers });

        if (!response.ok) {
          const body = await response.text();
          const error = new Error(`Failed to load remote schema (${response.status} ${response.statusText}): ${body}`);
          error.status = response.status;
          throw error;
        }

        const text = await response.text();
        const contentType = response.headers.get("content-type") || '';
        const parsed = assertSchema(parseSchemaText(text, contentType), path);

        console.log("📦 Loaded remote schema keys:", Object.keys(parsed));
        console.log("📦 OpenAPI version:", parsed.openapi || parsed.swagger);
        console.log("📦 Path count:", Object.keys(parsed.paths || {}).length);

        schemaCache.set(path, parsed);
        return parsed;
      } catch (error) {
        lastError = error;
        const status = Number(error?.status || 0);
        const isRetryable =
          status === 0 ||
          status === 408 ||
          status === 425 ||
          status === 429 ||
          status >= 500;

        if (!isRetryable || attempt === REMOTE_SCHEMA_MAX_ATTEMPTS) {
          break;
        }

        console.warn(`⏳ Remote schema load attempt ${attempt}/${REMOTE_SCHEMA_MAX_ATTEMPTS} failed; retrying in ${REMOTE_SCHEMA_RETRY_DELAY_MS}ms`);
        await sleep(REMOTE_SCHEMA_RETRY_DELAY_MS);
      }
    }

    throw lastError || new Error(`Failed to load remote schema from ${path}`);
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
