// Enhanced dynamic test that adapts to any OpenAPI schema
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { readFileSync } from "fs";
import { request as httpsRequest } from "https";
import { request as httpRequest } from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration - choose which test to run
const TEST_CONFIGS = {
  petstore: {
    name: "Petstore API (Local)",
    schemaPath: "./samples/petstore.yaml",
    isRemote: false
  },
  
  cms: {
    name: "CMS API (Remote)", 
    schemaPath: "http://localhost/public/api/system/swagger.json",
    isRemote: true,
    apiBaseUrl: "http://localhost/api",
    // apiToken: "your_bearer_token_here"
  }
};

// Choose which config to use
const ACTIVE_CONFIG = process.env.TEST_CONFIG || "petstore";  // Can be overridden with env var
const config = TEST_CONFIGS[ACTIVE_CONFIG];

if (!config) {
  console.error(`❌ Invalid TEST_CONFIG: ${ACTIVE_CONFIG}`);
  console.error(`Available configs: ${Object.keys(TEST_CONFIGS).join(', ')}`);
  process.exit(1);
}

console.log(`🧪 Testing: ${config.name}`);
console.log("SCHEMA_PATH:", config.schemaPath);

// Set environment variables for the server process
process.env.OPENAPI_URL = config.schemaPath;
if (config.apiBaseUrl) process.env.API_BASE_URL = config.apiBaseUrl;
if (config.apiToken) process.env.API_TOKEN = config.apiToken;

// Helper function to load remote schema
function loadRemoteSchema(url) {
  return new Promise((resolve, reject) => {
    const requester = url.startsWith("https") ? httpsRequest : httpRequest;
    const req = requester(url, (res) => {
      if (![200, 201].includes(res.statusCode)) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.end();
  });
}

// Load and analyze the schema for dynamic testing
async function loadAndAnalyzeSchema() {
  try {
    let schemaContent;
    if (config.isRemote) {
      console.log("🌐 Loading remote schema...");
      schemaContent = await loadRemoteSchema(config.schemaPath);
    } else {
      console.log("📁 Loading local schema...");
      schemaContent = readFileSync(config.schemaPath, 'utf8');
    }
    
    const schema = yaml.load(schemaContent);
    
    const analysis = {
      info: schema.info,
      paths: [],
      components: Object.keys(schema.components?.schemas || {}),
      hasAuth: !!schema.components?.securitySchemes,
      servers: schema.servers || []
    };
    
    // Find testable paths
    for (const [path, pathItem] of Object.entries(schema.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'delete'].includes(method.toLowerCase())) {
          analysis.paths.push({
            path,
            method: method.toLowerCase(),
            summary: operation.summary,
            hasParams: !!(operation.parameters?.length),
            hasBody: !!operation.requestBody,
            pathParams: path.includes('{')
          });
        }
      }
    }
    
    return { schema, analysis };
  } catch (error) {
    console.error("❌ Could not load schema:", error.message);
    process.exit(1);
  }
}

const { schema, analysis } = await loadAndAnalyzeSchema();

console.log("📊 Schema Analysis:", {
  title: analysis.info?.title || "Unknown API",
  version: analysis.info?.version || "Unknown",
  pathCount: analysis.paths.length,
  componentCount: analysis.components.length,
  hasAuth: analysis.hasAuth
});

// Set up the MCP client to communicate with our server
const transport = new StdioClientTransport({
  command: "node",
  args: [resolve(__dirname, "../src/client.js")], // Updated path
  env: { ...process.env }
});

const client = new Client({
  name: "openapi-schema-client",
  version: "1.0.0",
});

console.log("Resolved SCHEMA_PATH:", config.schemaPath);
const runTool = async (name, args = {}) => {
  const fullArgs = { openapiSchemaPath: config.schemaPath, ...args };
  return client.callTool({ name, arguments: fullArgs, _meta: { rawArgs: fullArgs } });
};

console.log("Connecting to MCP server...");
await client.connect(transport);
console.log("Connected to MCP server successfully!");

try {
  console.log("\n--- LISTING ENDPOINTS ---");
  const endpoints = await runTool("list-endpoints");
  console.log(endpoints.content[0].text);

  console.log("\n--- LIST COMPONENTS ---");
  const components = await runTool("list-components");
  console.log(components.content[0].text);

  // Test first available GET endpoint
  const getEndpoint = analysis.paths.find(p => p.method === 'get');
  if (getEndpoint) {
    console.log(`\n--- GET ENDPOINT DETAILS (${getEndpoint.path}) ---`);
    const endpointDetails = await runTool("get-endpoint", {
      path: getEndpoint.path,
      method: getEndpoint.method,
    });
    console.log(endpointDetails.content[0].text);
  }

  // Test first available POST endpoint with body
  const postEndpoint = analysis.paths.find(p => p.method === 'post' && p.hasBody);
  if (postEndpoint) {
    console.log(`\n--- GET REQUEST BODY SCHEMA (${postEndpoint.path}) ---`);
    const requestBody = await runTool("get-request-body", {
      path: postEndpoint.path,
      method: postEndpoint.method,
    });
    console.log(requestBody.content[0].text);
  }

  // Test first available component
  if (analysis.components.length > 0) {
    const firstComponent = analysis.components[0];
    console.log(`\n--- GET COMPONENT SCHEMA (${firstComponent}) ---`);
    const component = await runTool("get-component", {
      type: "schemas",
      name: firstComponent,
    });
    console.log(component.content[0].text);
  }

  // Dynamic search based on API title or first component
  const searchTerm = analysis.info?.title?.toLowerCase().split(' ')[0] || 
                     analysis.components[0]?.toLowerCase() || 
                     'api';
  console.log(`\n--- SEARCH SCHEMA ("${searchTerm}") ---`);
  const searchResults = await runTool("search-schema", {
    pattern: searchTerm,
  });
  console.log(searchResults.content[0].text);

  // Test path parameters if available
  const pathWithParams = analysis.paths.find(p => p.pathParams);
  if (pathWithParams) {
    console.log(`\n--- GET PATH PARAMETERS (${pathWithParams.path}) ---`);
    const parameters = await runTool("get-path-parameters", {
      path: pathWithParams.path,
      method: pathWithParams.method,
    });
    console.log(parameters.content[0].text);
  }

  // Test response schema for first GET endpoint
  if (getEndpoint) {
    console.log(`\n--- GET RESPONSE SCHEMA (${getEndpoint.path}) ---`);
    const response = await runTool("get-response-schema", {
      path: getEndpoint.path,
      method: getEndpoint.method,
      statusCode: "200",
    });
    console.log(response.content[0].text);
  }

  // Test security schemes if they exist
  if (analysis.hasAuth) {
    console.log("\n--- LIST SECURITY SCHEMES ---");
    const security = await runTool("list-security-schemes");
    console.log(security.content[0].text);
  }

  // Test HTTP execution tools if available
  console.log("\n--- TESTING HTTP EXECUTION TOOLS ---");
  
  // Test generic execute-request
  if (getEndpoint) {
    try {
      console.log(`\n--- EXECUTE REQUEST (${getEndpoint.method.toUpperCase()} ${getEndpoint.path}) ---`);
      const executeResult = await runTool("execute-request", {
        path: getEndpoint.path,
        method: getEndpoint.method,
        baseUrl: config.apiBaseUrl || analysis.servers[0]?.url || "https://api.example.com"
      });
      console.log(executeResult.content[0].text);
    } catch (error) {
      console.log(`⚠️ Execute request test failed: ${error.message}`);
    }
  }

  console.log("\n✅ === ALL TESTS COMPLETED ===");
  console.log(`📊 Test Summary:`);
  console.log(`   • API: ${analysis.info?.title || 'Unknown'} v${analysis.info?.version || '?'}`);
  console.log(`   • Source: ${config.isRemote ? 'Remote URL' : 'Local file'}`);
  console.log(`   • Paths tested: ${analysis.paths.length} total`);
  console.log(`   • Components tested: ${analysis.components.length} total`);
  console.log(`   • Authentication: ${analysis.hasAuth ? 'Yes' : 'No'}`);

} catch (error) {
  console.error("Error during testing:", error);
} finally {
  await client.close();
  console.log("\nTests completed, disconnected from server.");
}