# 🧪 Testing Suite

Comprehensive testing for the OpenAPI MCP Server across all transports and protocols.

## 📋 Test Files

### `test-server.js` - HTTP Server Testing
Tests the HTTP server endpoints using fetch requests.

**What it tests:**
- API `/call-tool` endpoint
- All schema analysis tools (list-endpoints, get-endpoint, etc.)
- Dynamic HTTP execution tools (search-*, create-*, etc.)
- Tool discovery and parameter validation

**Usage:**
```bash
npm test
```

### `test-mcp.js` - MCP Protocol Testing  
Tests the MCP JSON-RPC protocol endpoints.

**What it tests:**
- MCP initialization handshake
- `tools/list` method
- `tools/call` method
- Error handling for unsupported methods

**Usage:**
```bash
npm run test:mcp
```

### `test-client.js` - MCP Client Testing
Tests the complete MCP client workflow using STDIO transport.

**What it tests:**
- Full STDIO MCP client connection
- Dynamic schema analysis and adaptation
- All schema tools with real schema data
- HTTP execution tools (if configured)
- Supports multiple API configurations

**Usage:**
```bash
npm run test:client

# Test with different schema
TEST_CONFIG=cms npm run test:client
```

## 🔧 Test Configurations

The `test-client.js` supports multiple configurations:

### Petstore (Default)
```javascript
petstore: {
  name: "Petstore API (Local)",
  schemaPath: "./samples/petstore.yaml",
  isRemote: false
}
```

### Custom Remote API
```javascript
cms: {
  name: "CMS API (Remote)", 
  schemaPath: "http://localhost/public/api/system/swagger.json",
  isRemote: true,
  apiBaseUrl: "http://localhost/api",
  apiToken: "your_bearer_token_here"
}
```

## 🎯 Running All Tests

```bash
# Run complete test suite
npm run test:all

# Individual test suites
npm test           # HTTP server
npm run test:mcp   # MCP protocol  
npm run test:client # MCP client
```

## 🔍 What Gets Tested

### Schema Analysis Tools (9 tools)
- `list-endpoints` - API overview
- `get-endpoint` - Detailed endpoint info
- `get-request-body` - Request schemas
- `get-response-schema` - Response schemas
- `get-path-parameters` - Parameter definitions
- `list-components` - Schema components
- `get-component` - Component details
- `list-security-schemes` - Authentication
- `search-schema` - Full-text search

### HTTP Execution Tools (Dynamic)
- `execute-request` - Generic HTTP tool
- `search-{resource}` - GET endpoints
- `create-{resource}` - POST endpoints
- `read-{resource}` - GET with ID
- `delete-{resource}` - DELETE endpoints

### Protocol Compliance
- MCP initialization
- Tool registration and discovery
- Parameter validation
- Error handling
- STDIO transport
- HTTP transport

## 📊 Test Output

Each test provides:
- ✅ Success/failure indicators
- 📊 Schema analysis summary
- 🔍 Tool execution results
- ⚠️ Error details when applicable
- 📈 Coverage metrics

The tests automatically adapt to any OpenAPI schema, making them perfect for validating your server against different APIs!