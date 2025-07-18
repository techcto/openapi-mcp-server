# 🚀 Quick Start Guide

Get up and running with the OpenAPI MCP Server in minutes!

## 📦 Installation

```bash
git clone <your-repo-url>
cd openapi-mcp-server
npm install
```

## ⚡ Quick Test with Sample Data

```bash
# Copy the environment template
cp .env.example .env

# Edit .env and set:
# OPENAPI_URL=./samples/petstore.yaml

# Start the HTTP server
npm start
```

## 🧪 Test Everything Works

```bash
# Start the server (in another terminal)
npm start

# Run the comprehensive test suite
npm test

# Test MCP protocol specifically
npm run test:mcp

# Or test everything
npm run test:all
```

The tests will automatically discover your API endpoints and test all available tools!

## 🧪 Try the Tools

### Using the HTTP API

```bash
# List all available tools
curl -X POST http://localhost:8000/tools/list \
  -H "Content-Type: application/json"

# List all API endpoints
curl -X POST http://localhost:8000/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list-endpoints",
    "arguments": {}
  }'

# Get details for a specific endpoint
curl -X POST http://localhost:8000/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get-endpoint",
    "arguments": {
      "path": "/pets",
      "method": "get"
    }
  }'
```

### Using the MCP Client

```bash
# Start the MCP client (for Claude integration)
npm run client
```

## 🛠️ What You Can Do

With the Petstore sample, you'll have access to:

### Schema Analysis Tools
- **list-endpoints** - See all API paths
- **get-endpoint** - Get detailed endpoint info
- **get-request-body** - View request schemas
- **get-response-schema** - View response schemas
- **list-components** - See all schema components
- **search-schema** - Search across the schema

### HTTP Execution Tools (Dynamic)
- **search-pets** - List all pets
- **create-pets** - Create a new pet
- **read-pets** - Get a specific pet by ID
- **delete-pets** - Delete a pet
- **execute-request** - Make custom API calls

## 🔧 Next Steps

1. **Replace with your API**: Update `OPENAPI_URL` in `.env` to point to your actual OpenAPI schema
2. **Configure authentication**: Set `API_TOKEN` if your API requires authentication
3. **Set base URL**: Configure `API_BASE_URL` for API execution tools
4. **Integrate with Claude**: Use the MCP client for AI assistant integration

## 📚 Full Documentation

See [README.md](./README.md) for complete documentation and advanced configuration options.