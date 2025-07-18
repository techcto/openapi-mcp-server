#!/usr/bin/env node
import fetch from "node-fetch";

const baseUrl = "http://localhost:8000/mcp";

const sendMcpMessage = async (method, params = {}) => {
  const message = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params
  };

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error(`❌ ${method} failed:`, err.message);
    return null;
  }
};

console.log("🔌 Testing MCP Protocol endpoints...\n");

// Test MCP initialization
console.log("🔧 Testing MCP initialize...");
const initResult = await sendMcpMessage("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: {
    name: "test-client",
    version: "1.0.0"
  }
});
console.log(JSON.stringify(initResult, null, 2));

// Test tools list
console.log("\n🔧 Testing MCP tools/list...");
const toolsResult = await sendMcpMessage("tools/list");
console.log(`Found ${toolsResult?.result?.tools?.length || 0} tools`);
if (toolsResult?.result?.tools?.length > 0) {
  console.log("First few tools:", toolsResult.result.tools.slice(0, 3).map(t => t.name));
}

// Test tool call
if (toolsResult?.result?.tools?.length > 0) {
  const firstTool = toolsResult.result.tools[0];
  console.log(`\n🔧 Testing MCP tools/call with ${firstTool.name}...`);
  
  const toolCallResult = await sendMcpMessage("tools/call", {
    name: firstTool.name,
    arguments: {}
  });
  
  if (toolCallResult?.result?.content?.[0]?.text) {
    console.log("✅ Tool call successful");
    console.log("Result preview:", toolCallResult.result.content[0].text.slice(0, 200) + "...");
  } else {
    console.log("❌ Tool call failed or no content");
    console.log(JSON.stringify(toolCallResult, null, 2));
  }
}

// Test unsupported method
console.log("\n🔧 Testing unsupported method...");
const unsupportedResult = await sendMcpMessage("unsupported/method");
console.log("Expected error:", unsupportedResult?.error?.message);

console.log("\n🎉 MCP Protocol testing complete!");