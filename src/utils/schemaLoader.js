import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import fetch from "node-fetch";

/**
 * Load OpenAPI schema from a local file or remote URL (YAML or JSON)
 */
export const loadSchema = async (path) => {
  if (!path) throw new Error("loadSchema: Missing schema path");

  // Fetch remote schema
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const headers = {};
      if (process.env.API_TOKEN) {
        headers["Authorization"] = `Bearer ${process.env.API_TOKEN}`;
      }

      const response = await fetch(path, { headers });

      if (!response.ok) {
        const body = await response.text();
        console.error(`Fetch failed: ${response.status} ${response.statusText}`);
        console.error("Response body:", body);
        process.exit(1);
      }

      const text = await response.text();
      const contentType = response.headers.get("content-type");

      let parsed;
      if (contentType && contentType.includes("yaml")) {
        parsed = yaml.load(text);
      } else {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = yaml.load(text); // fallback
        }
      }

      if (!parsed || typeof parsed !== "object") {
        console.error("Schema parsing returned null or invalid object.");
        process.exit(1);
      }

      console.log("📦 Loaded remote schema keys:", Object.keys(parsed));
      console.log("📦 OpenAPI version:", parsed.openapi || parsed.swagger);
      console.log("📦 Path count:", Object.keys(parsed.paths || {}).length);

      return parsed;
    } catch (err) {
      console.error("❌ Error loading remote schema:", err.stack || err.message);
      process.exit(1);
    }
  }

  // Fallback: local path
  try {
    const fullPath = resolve(path);
    const fileContent = readFileSync(fullPath, "utf8");
    const parsed = yaml.load(fileContent);

    console.log("📦 Loaded local schema keys:", Object.keys(parsed));
    console.log("📦 OpenAPI version:", parsed.openapi || parsed.swagger);
    console.log("📦 Path count:", Object.keys(parsed.paths || {}).length);

    return parsed;
  } catch (err) {
    console.error("❌ Error loading local schema:", err.message);
    process.exit(1);
  }
};