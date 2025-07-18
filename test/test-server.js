#!/usr/bin/env node
import fetch from "node-fetch";

const baseUrl = "http://localhost:8000/call-tool";

const callTool = async (name, args = {}) => {
  const payload = {
    name,
    arguments: args, // do not inject openapiSchemaPath; let server default it
  };

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error(`❌ ${name} failed:`, err.message);
    return null;
  }
};

console.log("🔍 Fetching endpoints dynamically...");
const endpoints = await callTool("list-endpoints");

if (!endpoints || !endpoints.content?.[0]?.text) {
  console.error("❌ Could not fetch endpoint list. Aborting.");
  process.exit(1);
}

console.log("✅ Endpoints loaded. Running tool tests...\n");

const yamlText = endpoints.content[0].text;
const lines = yamlText.split("\n");
const firstLine = lines.find((line) => line.includes(":"));
const [firstPath, methodLine] = firstLine?.split(":") || [];
const firstMethod = methodLine?.match(/([A-Z]+)/)?.[1]?.toLowerCase() || "get";

if (!firstPath) {
  console.error("❌ Could not parse a path/method from endpoint list.");
  process.exit(1);
}

// Run the initial batch of tool tests
const toolTests = [
  { name: "list-endpoints", arguments: {} },
  { name: "get-endpoint", arguments: { path: firstPath, method: firstMethod } },
  { name: "get-request-body", arguments: { path: firstPath, method: firstMethod } },
  { name: "get-response-schema", arguments: { path: firstPath, method: firstMethod, statusCode: "200" } },
  { name: "get-path-parameters", arguments: { path: firstPath, method: firstMethod } },
  { name: "list-components", arguments: {} },
  { name: "list-security-schemes", arguments: {} },
  { name: "search-schema", arguments: { pattern: firstPath.split("/").filter(Boolean)[0] || "api" } },
];

for (const test of toolTests) {
  console.log(`\n🔧 Testing ${test.name}...`);
  const result = await callTool(test.name, test.arguments);
  console.log(result?.content?.[0]?.text || JSON.stringify(result, null, 2));

  // Store components for follow-up testing
  if (test.name === "list-components" && result?.content?.[0]?.text) {
    const componentMatch = result.content[0].text.match(/schemas:\s*\n\s*- (\w+)/);
    if (componentMatch?.[1]) {
      const firstComponent = componentMatch[1];
      console.log(`\n🔧 Testing get-component (${firstComponent})...`);
      const compResult = await callTool("get-component", {
        type: "schemas",  // Fixed: should be 'type' not 'componentType'
        name: firstComponent,  // Fixed: should be 'name' not 'componentName'
      });
      console.log(compResult?.content?.[0]?.text || JSON.stringify(compResult, null, 2));
    } else {
      console.warn("⚠️ Could not extract component name from list-components.");
    }
  }
}

// Test HTTP execution tools if available
console.log(`\n🚀 Testing HTTP execution tools...`);

// Test the generic execute-request tool
const executeTest = await callTool("execute-request", {
  path: firstPath,
  method: firstMethod,
  baseUrl: "https://petstore.example.com/api/v1"
});

if (executeTest) {
  console.log(`\n🔧 Testing execute-request (${firstMethod.toUpperCase()} ${firstPath})...`);
  console.log(executeTest?.content?.[0]?.text || JSON.stringify(executeTest, null, 2));
}

// Test dynamically generated CRUD tools
const possibleTools = [
  `search-${firstPath.split("/").filter(Boolean)[0]}`,
  `create-${firstPath.split("/").filter(Boolean)[0]}`,
  `read-${firstPath.split("/").filter(Boolean)[0]}`,
  `delete-${firstPath.split("/").filter(Boolean)[0]}`
];

for (const toolName of possibleTools) {
  console.log(`\n🔧 Testing ${toolName}...`);
  const result = await callTool(toolName, {});
  if (result) {
    console.log("✅ Tool exists:", result?.content?.[0]?.text?.slice(0, 200) + "..." || JSON.stringify(result, null, 2));
  } else {
    console.log("❌ Tool not available or failed");
  }
}

console.log("\n🎉 Testing complete!");