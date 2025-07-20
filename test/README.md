# 🧪 OpenAPI MCP Server Testing Suite

Comprehensive testing framework that validates the OpenAPI MCP Server against any OpenAPI specification, ensuring tools work correctly across different API schemas and transports.

## 🎯 Why These Tests Matter

This server works with **any** OpenAPI spec - from simple Petstore APIs to complex enterprise systems. The tests automatically adapt to whatever schema you provide, ensuring:

- ✅ **Schema Analysis Tools** work with your specific API structure
- ✅ **HTTP Execution Tools** are generated correctly for your endpoints  
- ✅ **MCP Protocol** compliance across HTTP and STDIO transports
- ✅ **Parameter Handling** works with your specific data types
- ✅ **Authentication** flows function with your security schemes

## 📋 Test Files Overview

### `test-server.js` - HTTP Server Testing
Tests the HTTP server endpoints that power web integrations and debugging.

**What it validates:**
- All schema analysis tools with your OpenAPI spec
- Dynamic HTTP execution tool generation
- Endpoint discovery and tool naming
- Parameter validation and error handling
- API `/call-tool` endpoint functionality

**Usage:**
```bash
npm test
```

### `test-mcp.js` - MCP Protocol Testing  
Tests MCP JSON-RPC protocol compliance for AI assistant integration.

**What it validates:**
- MCP initialization handshake
- `tools/list` method returns generated tools
- `tools/call` method executes tools correctly
- Error handling for malformed requests
- Protocol version compatibility

**Usage:**
```bash
npm run test:mcp
```

### `test-client.js` - Complete STDIO Client Testing
Tests the full MCP client workflow that Claude Desktop uses.

**What it validates:**
- Complete STDIO MCP client connection
- Dynamic tool adaptation to your specific API
- All schema analysis tools with real data
- HTTP execution tools (if API is accessible)
- Cross-transport parameter handling

**Usage:**
```bash
npm run test:client

# Test with your own API
TEST_CONFIG=custom npm run test:client
```

## 🔧 Configurable Test Scenarios

The test suite supports multiple API configurations to validate different scenarios:

### Built-in Test Configs

#### Petstore (Default - Local File)
```javascript
petstore: {
  name: "Petstore API (Local)",
  schemaPath: "./samples/petstore.yaml",
  isRemote: false
}
```

#### CMS (Remote API Example)
```javascript
cms: {
  name: "CMS API (Remote)", 
  schemaPath: "http://localhost/public/api/system/swagger.json",
  isRemote: true,
  apiBaseUrl: "http://localhost/api",
  apiToken: "your_bearer_token_here"
}
```

### Adding Your Own API
Create a new test config in `test-client.js`:

```javascript
yourapi: {
  name: "Your API Name",
  schemaPath: "https://your-api.com/swagger.json",
  isRemote: true,
  apiBaseUrl: "https://your-api.com/api",
  apiToken: process.env.YOUR_API_TOKEN
}
```

Then test with:
```bash
TEST_CONFIG=yourapi npm run test:client
```

## 🎯 Running Tests

### Quick Validation
```bash
# Test with default Petstore API
npm run test:all
```

### Individual Test Suites
```bash
npm test              # HTTP server endpoints
npm run test:mcp      # MCP protocol compliance  
npm run test:client   # Full STDIO client workflow
```

### Testing Different APIs
```bash
# Test with remote CMS API
TEST_CONFIG=cms npm run test:client

# Test with your custom API
export OPENAPI_URL="https://your-api.com/swagger.json"
export API_BASE_URL="https://your-api.com/api"
npm run test:client
```

## 🔍 What Gets Tested

### Schema Analysis Tools (9 Core Tools)
These work with **any** OpenAPI spec:

- **`list-endpoints`** - Discovers all paths and methods in your API
- **`get-endpoint`** - Extracts detailed info for specific endpoints
- **`get-request-body`** - Analyzes request schemas and validation
- **`get-response-schema`** - Documents response formats
- **`get-path-parameters`** - Lists path, query, and header parameters
- **`list-components`** - Shows reusable schema components
- **`get-component`** - Detailed component definitions
- **`list-security-schemes`** - Security and authentication methods
- **`search-schema`** - Full-text search across the entire spec

### Dynamic HTTP Execution Tools
Generated automatically based on your API structure:

- **`execute-request`** - Generic HTTP execution engine
- **`search-{resource}`** - GET endpoints without parameters
- **`create-{resource}`** - POST endpoints for creation
- **`read-{resource}`** - GET endpoints with ID parameters
- **`update-{resource}`** - PUT/PATCH endpoints for updates
- **`delete-{resource}`** - DELETE endpoints

### Protocol Compliance Testing
- **MCP Initialization** - Handshake and capability negotiation
- **Tool Registration** - Ensures all generated tools are properly registered
- **Parameter Validation** - Zod schema validation for all inputs
- **Error Handling** - Graceful failure modes and error messages
- **Transport Flexibility** - HTTP and STDIO transport compatibility

## 📊 Understanding Test Output

### Successful Run Example
```
🧪 Testing: Petstore API (Local)
📊 Schema Analysis:
   • API: Swagger Petstore v1.0.6
   • Paths tested: 14 total
   • Components tested: 8 total
   • Authentication: Yes

✅ === ALL TESTS COMPLETED ===
📋 Tools Generated:
   • Schema Tools: 9
   • Execution Tools: 23
   • Total: 32 tools
```

### Common Issues and Solutions

**"Schema not found"**
```bash
❌ Could not load schema: HTTP 404
```
*Solution*: Verify the `OPENAPI_URL` is accessible

**"No tools generated"**
```bash
⚠️ No execution tools generated
```
*Solution*: Check that your OpenAPI spec has a `paths` section with HTTP methods

**"API calls failing"**
```bash
❌ Tool call failed: 401 Unauthorized
```
*Solution*: Set `API_TOKEN` environment variable for authentication

## 🔬 Advanced Testing

### Schema Validation
```bash
# Test schema loading with different formats
export OPENAPI_URL="./spec.yaml"     # YAML format
export OPENAPI_URL="./spec.json"     # JSON format
export OPENAPI_URL="http://api.com/swagger.json"  # Remote URL
npm run test:client
```

### Authentication Testing
```bash
# Test Bearer token authentication
export API_TOKEN="eyJhbGciOiJIUzI1NiIs..."
npm run test:client

# Test API key authentication  
export API_KEY="your-api-key"
npm run test:client
```

### Error Condition Testing
```bash
# Test with invalid schema
export OPENAPI_URL="./nonexistent.yaml"
npm run test:client

# Test with malformed URL
export OPENAPI_URL="not-a-url"
npm run test:client
```

## 📈 Test Coverage

The test suite provides comprehensive coverage:

- **Schema Formats**: OpenAPI 3.x, Swagger 2.x, YAML, JSON
- **API Types**: REST APIs, CRUD operations, complex parameters
- **Authentication**: Bearer tokens, API keys, OAuth2 flows
- **Transports**: HTTP endpoints, STDIO client, SSE streaming
- **Error Conditions**: Network failures, auth errors, malformed data
- **Performance**: Tool generation speed, memory usage

## 🎛️ Test Configuration

### Environment Variables
```bash
# Schema location
OPENAPI_URL="path/to/schema"

# API execution
API_BASE_URL="https://api.example.com"
API_TOKEN="bearer-token"

# Test behavior
TEST_CONFIG="petstore|cms|custom"
NODE_ENV="test"
```

### Custom Test Configs
Add to `test-client.js`:
```javascript
const TEST_CONFIGS = {
  // ... existing configs
  myapi: {
    name: "My Custom API",
    schemaPath: process.env.MY_SCHEMA_URL,
    isRemote: true,
    apiBaseUrl: process.env.MY_API_BASE,
    apiToken: process.env.MY_API_TOKEN
  }
};
```

## 🚀 Integration Testing

### CI/CD Pipeline Integration
```yaml
# .github/workflows/test.yml
- name: Test OpenAPI MCP Server
  run: |
    npm install
    npm run test:all
    
    # Test with multiple APIs
    TEST_CONFIG=petstore npm run test:client
    TEST_CONFIG=cms npm run test:client
```

### Pre-deployment Validation
```bash
# Validate your API before deploying MCP server
export OPENAPI_URL="https://staging-api.com/swagger.json"
export API_BASE_URL="https://staging-api.com/api"
npm run test:all
```

---

**The test suite ensures your OpenAPI spec will work perfectly with the MCP server, regardless of complexity or structure.**