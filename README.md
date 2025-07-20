# OpenAPI MCP Server

A powerful Node.js server that dynamically converts any OpenAPI/Swagger specification into **Model Context Protocol (MCP) tools**, making APIs instantly accessible to AI assistants like Claude.

## 🚀 What This Does

Transform any REST API into AI-friendly tools in seconds:

1. **Point to any OpenAPI spec** (local file or URL)
2. **Get instant MCP tools** for schema analysis AND API execution
3. **Use with Claude** or any MCP-compatible AI assistant

## ✨ Key Features

- **Universal Compatibility**: Works with any OpenAPI 2.x or 3.x specification
- **Dual Tool Types**: Schema analysis tools + Dynamic HTTP execution tools
- **Multiple Transports**: HTTP server + STDIO for Claude integration
- **Auto-Discovery**: Automatically generates CRUD tools from your API paths
- **Zero Configuration**: Just point to a schema and go
- **Production Ready**: Full error handling, logging, and monitoring

## 📦 Quick Start

```bash
# Install
git clone https://github.com/your-username/openapi-mcp-server.git
cd openapi-mcp-server
npm install

# Configure (pick one)
export OPENAPI_URL="https://petstore.swagger.io/v2/swagger.json"
export OPENAPI_URL="./samples/petstore.yaml"
export OPENAPI_URL="https://your-api.com/swagger.json"

# Start the server
npm start
```

**That's it!** Your API is now available as MCP tools.

## 🛠️ What You Get

### Schema Analysis Tools (Always Available)
- **list-endpoints** - See all API paths and methods
- **get-endpoint** - Detailed endpoint information
- **get-request-body** - Request schemas and validation
- **get-response-schema** - Response formats
- **list-components** - Schema components and models
- **search-schema** - Full-text search across the spec
- **list-security-schemes** - Authentication methods

### Dynamic HTTP Execution Tools (Auto-Generated)
For each API endpoint, get semantic tools like:
- **search-users** - `GET /users` 
- **create-user** - `POST /users`
- **read-user** - `GET /users/{id}`
- **update-user** - `PUT /users/{id}`
- **delete-user** - `DELETE /users/{id}`
- **execute-request** - Generic HTTP execution tool

## 🎯 Real-World Examples

### Petstore API
```bash
export OPENAPI_URL="https://petstore.swagger.io/v2/swagger.json"
npm start
```
**Result**: 15+ tools including `search-pet`, `create-pet`, `update-pet`, etc.

### Your Company API
```bash
export OPENAPI_URL="https://your-company.com/api/swagger.json"
export API_BASE_URL="https://your-company.com/api"
export API_TOKEN="your-bearer-token"
npm start
```
**Result**: Full API access through semantic tools + Claude integration

### Local Development
```bash
export OPENAPI_URL="./openapi.yaml"
export API_BASE_URL="http://localhost:3000"
npm start
```
**Result**: Local API testing through MCP tools

## 🔧 Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAPI_URL` | Path or URL to OpenAPI spec | `./spec.yaml` or `https://api.com/swagger.json` |
| `API_BASE_URL` | Base URL for API execution | `https://api.example.com` |
| `API_TOKEN` | Bearer token for authentication | `eyJhbGciOiJIUzI1NiIs...` |
| `PORT` | Server port | `8000` (default) |

## 🤖 Claude Integration

### For Desktop Claude
1. Start the MCP client: `npm run client`
2. Add to your Claude config:
```json
{
  "mcpServers": {
    "openapi": {
      "command": "node",
      "args": ["/path/to/openapi-mcp-server/src/client.js"],
      "env": {
        "OPENAPI_URL": "https://your-api.com/swagger.json"
      }
    }
  }
}
```

### For Web/API Usage
Use the HTTP endpoints directly:
```bash
curl -X POST http://localhost:8000/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "list-endpoints", "arguments": {}}'
```

## 📡 Available Transports

### HTTP Server (Web APIs)
- `POST /tools/list` - List available tools
- `POST /tools/call` - Execute tools
- `GET /sse` - Server-Sent Events for real-time
- `GET /health` - Health monitoring

### STDIO (Claude Integration)
- `npm run client` - Direct MCP protocol communication
- Perfect for Claude Desktop integration
- Full streaming support

## 🧪 Testing

```bash
# Test with included Petstore sample
cp .env.example .env
# Edit .env: OPENAPI_URL=./samples/petstore.yaml
npm start

# Run comprehensive tests
npm test        # HTTP endpoints
npm run test:mcp    # MCP protocol
npm run test:client # Full STDIO client
npm run test:all    # Everything
```

## 📁 Project Structure

```
├── src/
│   ├── server.js           # HTTP server entry point
│   ├── client.js           # STDIO client entry point
│   ├── tools/
│   │   ├── registerTools.js    # Schema analysis tools
│   │   └── registerActions.js  # HTTP execution tools
│   ├── utils/
│   │   ├── schemaLoader.js     # OpenAPI schema loading
│   │   └── toolUtils.js        # Tool management
│   └── routes/             # HTTP route handlers
├── test/                   # Comprehensive test suite
└── samples/                # Example OpenAPI specs
```

## 🔍 How It Works

1. **Schema Loading**: Loads OpenAPI spec from file or URL
2. **Tool Generation**: Creates MCP tools for both analysis and execution
3. **Dynamic Mapping**: Maps HTTP operations to semantic tool names
4. **Parameter Handling**: Automatically handles path/query/body parameters
5. **Authentication**: Supports Bearer tokens and API keys
6. **Transport Agnostic**: Works over HTTP or STDIO

## 🎨 Advanced Usage

### Custom Tool Filtering
```javascript
// Only generate tools for specific paths
const filteredPaths = ['/users', '/orders'];
```

### Authentication Strategies
```bash
# Bearer token
export API_TOKEN="your-bearer-token"

# API key in header
export API_KEY="your-api-key"
```

### Multiple APIs
Run multiple instances with different configs:
```bash
# API 1
PORT=8001 OPENAPI_URL="api1.yaml" npm start &

# API 2  
PORT=8002 OPENAPI_URL="api2.yaml" npm start &
```

## 🚦 Supported APIs

- ✅ **OpenAPI 3.x** (native support)
- ✅ **Swagger 2.x** (full compatibility)
- ✅ **REST APIs** with standard HTTP methods
- ✅ **Authentication**: Bearer, API Key, OAuth2
- ✅ **Parameter Types**: Path, Query, Header, Body
- ✅ **Content Types**: JSON, Form data, URL encoded

## 📊 Monitoring & Logging

- Built-in health checks at `/health`
- Structured logging with multiple levels
- Request/response tracking
- Error handling and reporting
- Performance metrics

## 🔒 Security

- Request validation using Zod schemas
- Bearer token support
- CORS configuration
- Rate limiting (configurable)
- Error sanitization in production

## 🤝 Contributing

1. Fork the repository
2. Add support for your OpenAPI spec
3. Run the test suite: `npm run test:all`
4. Submit a pull request

## 📄 License

MIT License - use this to make any API accessible to AI assistants!

## 🙏 Attribution

Originally inspired by [`openapi-introspect`](https://github.com/hannesjunnila/openapi-introspect) by Hannes Junnila. This project expands the concept with dynamic tool generation, HTTP execution, and full MCP protocol support.

---

**Transform any API into AI-accessible tools in minutes, not hours.**