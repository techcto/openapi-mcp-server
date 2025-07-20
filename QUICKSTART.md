# 🚀 Quick Start Guide

Get any OpenAPI/Swagger API working with AI assistants in under 5 minutes!

## 📦 Installation

```bash
git clone https://github.com/your-username/openapi-mcp-server.git
cd openapi-mcp-server
npm install
```

## ⚡ Choose Your API

Pick any OpenAPI specification to get started:

### Option 1: Public API (Petstore Example)
```bash
export OPENAPI_URL="https://petstore.swagger.io/v2/swagger.json"
export API_BASE_URL="https://petstore.swagger.io/v2"
```

### Option 2: Local File
```bash
cp .env.example .env
# Edit .env and set:
# OPENAPI_URL=./samples/petstore.yaml
```

### Option 3: Your Company API
```bash
export OPENAPI_URL="https://your-api.com/swagger.json"
export API_BASE_URL="https://your-api.com/api"
export API_TOKEN="your-bearer-token-here"
```

## 🚀 Start the Server

```bash
npm start
```

You'll see output like:
```
🚀 MCP server running at http://localhost:8000
📋 Available tools: 47
🔗 Server info: http://localhost:8000
```

## 🧪 Test It Works

```bash
# Test the tools are working
npm test

# Test MCP protocol
npm run test:mcp

# Test everything including STDIO client
npm run test:all
```

## 🛠️ Try the Tools

### Using HTTP API (Great for Testing)

```bash
# See what tools are available
curl -X POST http://localhost:8000/tools/list \
  -H "Content-Type: application/json" | jq '.tools[].name'

# Explore the API structure
curl -X POST http://localhost:8000/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "list-endpoints", "arguments": {}}'

# Get details about a specific endpoint
curl -X POST http://localhost:8000/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get-endpoint",
    "arguments": {"path": "/pet", "method": "post"}
  }'

# Execute an actual API call (if you have a real API)
curl -X POST http://localhost:8000/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "search-pet",
    "arguments": {"status": "available"}
  }'
```

### Using with Claude Desktop

1. Start the MCP client:
```bash
npm run client
```

2. Add to your Claude config file:
```json
{
  "mcpServers": {
    "openapi": {
      "command": "node",
      "args": ["/full/path/to/openapi-mcp-server/src/client.js"],
      "env": {
        "OPENAPI_URL": "https://petstore.swagger.io/v2/swagger.json",
        "API_BASE_URL": "https://petstore.swagger.io/v2"
      }
    }
  }
}
```

3. Restart Claude and ask: *"What endpoints does this API have?"*

## 🎯 What You Get

### For Petstore API, you'll get tools like:
- **search-pet** - Find pets by status
- **create-pet** - Add a new pet  
- **read-pet** - Get pet by ID
- **update-pet** - Update pet info
- **delete-pet** - Remove a pet
- **search-store** - Check inventory
- **create-user** - Register new user
- ...and more!

### Plus schema analysis tools:
- **list-endpoints** - See all API paths
- **get-endpoint** - Get endpoint details
- **search-schema** - Search the OpenAPI spec
- **list-components** - See data models

## 🔧 Real-World Examples

### GitHub API
```bash
export OPENAPI_URL="https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json"
export API_BASE_URL="https://api.github.com"
export API_TOKEN="ghp_your_token_here"
npm start
```

### Stripe API  
```bash
export OPENAPI_URL="https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json"
export API_BASE_URL="https://api.stripe.com"
export API_TOKEN="sk_test_your_key_here"
npm start
```

### Your Local Development API
```bash
export OPENAPI_URL="http://localhost:3000/api/docs/json"
export API_BASE_URL="http://localhost:3000/api"
npm start
```

## 🔍 Troubleshooting

### "Schema not found"
- Check the URL is accessible: `curl $OPENAPI_URL`
- Try a local file: `export OPENAPI_URL="./path/to/spec.yaml"`

### "API calls failing"
- Verify `API_BASE_URL` matches your API
- Check authentication: `export API_TOKEN="your-token"`
- Test manually: `curl -H "Authorization: Bearer $API_TOKEN" $API_BASE_URL/endpoint`

### "No tools generated"
- Check OpenAPI spec has `paths` section
- Ensure HTTP methods are lowercase in spec
- Look at server logs for parsing errors

## 📚 Next Steps

1. **Customize for your API**: Update environment variables
2. **Add authentication**: Set `API_TOKEN` for protected APIs  
3. **Integrate with Claude**: Follow the Claude Desktop setup
4. **Build workflows**: Combine multiple tool calls for complex tasks
5. **Monitor usage**: Check `/health` endpoint for metrics

## 🎓 Learn More

- **Full documentation**: [README.md](./README.md)
- **API examples**: [/samples](./samples/) directory
- **Test different configs**: `TEST_CONFIG=cms npm run test:client`
- **Explore tools**: Visit `http://localhost:8000` for API documentation

---

**You're ready! Any OpenAPI spec can now be used by AI assistants through MCP tools.**