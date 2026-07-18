# OpenAPI MCP AgentCore Quickstart

Turn an OpenAPI or Swagger API into MCP tools for an AI agent in a few minutes.

This guide is for **OpenAPI MCP AgentCore**, the generic product that reads an
API specification and creates discovery and execution tools. It is different
from **CMS MCP AgentCore**, the OpenADA product that understands CMS-specific
MCP workflows. Use CMS MCP AgentCore when the agent should operate a CMS
through its native MCP contract; use this product when the integration starts
with an OpenAPI/Swagger document.

## 📦 Installation

```bash
git clone https://github.com/techcto/openapi-mcp-server.git
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
export OPENAPI_AUTH_TOKEN="your-bearer-token-here"
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

### 🐳 Or with Docker Compose

Same result, no local Node install needed:

```bash
cp .env.example .env
# edit .env with your OPENAPI_URL / API_BASE_URL / OPENAPI_AUTH_TOKEN

docker compose up --build
```

This builds the same image used for AWS Marketplace / Bedrock AgentCore Runtime, so anything working here will work identically there.

## AWS Marketplace And AgentCore Runtime

1. Subscribe to **OpenAPI MCP** in AWS Marketplace and select the
   **Container image** delivery method for **Bedrock AgentCore**.
2. Create an AgentCore Runtime from the subscribed image, or launch the
   [product CloudFormation template](./devops/cloudformation/agentcore-runtime.yaml)
   from the repository's public CFT location.

Launch the published CloudFormation template in the AWS console:

<a href="https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?templateURL=https://openapi-mcp.s3.us-east-1.amazonaws.com/cloudformation/agentcore-runtime.yaml&amp;stackName=openapi-mcp-agentcore"><img src="https://raw.githubusercontent.com/solodev/aws/master/pages/images/solodev-launch-btn.png" width="200" alt="Launch OpenAPI MCP AgentCore" /></a>

The launch link opens CloudFormation in the console's current Region. Choose
the Region where you want the AgentCore runtime before creating the stack.

3. Configure the runtime with the target API values below. These are values for
   the API being connected, not AWS access keys:

   | Variable | Required | Value |
   |---|---:|---|
   | `OPENAPI_URL` | Yes | Public or reachable JSON/YAML OpenAPI specification |
   | `API_BASE_URL` | Yes | Base URL called by generated tools |
   | `OPENAPI_AUTH_TOKEN` | No | Bearer token for the target API |
   | `MCP_ALLOWED_TOOLS` | No | Comma-separated tool allowlist for large APIs |

4. Wait for the runtime to become **Ready**, then copy its Runtime ARN and
   invoke it with an AWS-authenticated AgentCore client. The runtime boundary
   uses IAM/SigV4; do not put AWS credentials in an MCP JSON-RPC message.

For a CMS API, use the CMS's OpenAPI document and API base URL. If the goal is
for an agent to understand CMS publishing, permissions, or other native CMS
workflows, use [CMS MCP AgentCore](https://github.com/techcto/openada/tree/main/devops/agentcore)
instead.

### AgentCore console smoke test

The AgentCore test panel sends JSON-RPC to an MCP server, so the input is not a
generic `{"prompt":"..."}` object. Run these in order:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"aws-console","version":"1.0"}}}
```

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
```

Then call one tool returned by `tools/list`, for example:

```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list-endpoints","arguments":{}}}
```

The exact generated tool names depend on the target specification. If the
runtime returns HTTP 400, first check CloudWatch logs and verify that
`OPENAPI_URL` is reachable from the runtime, contains a `paths` object, and
that `API_BASE_URL` is the matching service origin.

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

### For a content API, you'll get tools like:
- **search-pages** - Find pages by title, path, or status
- **create-page** - Create a new page
- **read-page** - Get a page by ID
- **update-page** - Update page content
- **publish-page** - Publish a page
- **read-post** - Load a content record
- **update-post** - Edit an existing content record
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
export OPENAPI_AUTH_TOKEN="ghp_your_token_here"
npm start
```

### Stripe API  
```bash
export OPENAPI_URL="https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json"
export API_BASE_URL="https://api.stripe.com"
export OPENAPI_AUTH_TOKEN="sk_test_your_key_here"
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
- Check authentication: `export OPENAPI_AUTH_TOKEN="your-token"`
- Test manually: `curl -H "Authorization: Bearer $OPENAPI_AUTH_TOKEN" $API_BASE_URL/endpoint`

### "No tools generated"
- Check OpenAPI spec has `paths` section
- Ensure HTTP methods are lowercase in spec
- Look at server logs for parsing errors

## 📚 Next Steps

1. **Customize for your API**: Update environment variables
2. **Add authentication**: Set `OPENAPI_AUTH_TOKEN` for protected APIs  
3. **Integrate with Claude**: Follow the Claude Desktop setup
4. **Build workflows**: Combine multiple tool calls for complex tasks
5. **Monitor usage**: Check `/health` endpoint for metrics

## 🎓 Learn More

- **Full documentation**: [README.md](./README.md)
- **Deploying to AWS Marketplace / Bedrock AgentCore Runtime**: [docs/marketplace-quickstart.md](./docs/marketplace-quickstart.md)
- **API examples**: [/samples](./samples/) directory
- **Test different configs**: `TEST_CONFIG=cms npm run test:client`
- **Explore tools**: Visit `http://localhost:8000` for API documentation

---

**You're ready! Any OpenAPI spec can now be used by AI assistants through MCP tools.**
