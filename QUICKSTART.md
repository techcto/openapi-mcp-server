# OpenAPI MCP AgentCore Quickstart

Turn an OpenAPI or Swagger API into MCP tools for an AI agent in a few minutes.

This guide is for **OpenAPI MCP AgentCore**, the generic product that reads an
API specification and creates discovery and execution tools. It works across
CMS platforms such as Solodev, WordPress, and Drupal, as well as CRM, support,
commerce, Kubernetes, DevOps, and cloud APIs. Use a native MCP integration when
domain-specific workflows are more important than generated API operations;
use this product when the OpenAPI/Swagger contract is the authoritative
integration surface.

There are two deployment choices: **Public OpenAPI MCP AgentCore** runs the
container on Amazon Bedrock AgentCore Runtime, while **Private OpenAPI MCP**
runs the same container inside a customer's AWS account and network boundary.

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

## Private OpenAPI MCP

Run the same image in a customer-managed ECS service, EKS workload, or other
private container platform when the target API is internal or customer data
must remain inside the organization's AWS boundary. Set the same variables as
local development, but use private or internal URLs:

```bash
OPENAPI_URL=https://internal-api.example.com/openapi.json
API_BASE_URL=https://internal-api.example.com/api
OPENAPI_AUTH_TOKEN=replace-with-a-secret-reference
```

In production, inject the token from AWS Secrets Manager or the container
platform's secret integration rather than putting the literal token in a
CloudFormation parameter, image, `.env` file, or source repository. Put the
service behind the customer's internal load balancer, VPN, or authenticated
gateway. The container is stateless and does not need a separate database.

Private OpenAPI MCP is the right choice for private SaaS tenant APIs, internal
CRM or ticketing systems, Kubernetes control planes, deployment platforms, and
any API that is documented with Swagger/OpenAPI but should not be exposed to
the public internet.

### Launch the private ECS/Fargate stack

After subscribing to OpenAPI MCP, use the same Marketplace image inside your
AWS account with the published CloudFormation template:

[Subscribe to OpenAPI MCP in AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-g3jgkgokncmwi)

<a href="https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?templateURL=https://openapi-mcp.s3.us-east-1.amazonaws.com/cloudformation/private-ecs.yaml&amp;stackName=openapi-mcp-private"><img src="https://raw.githubusercontent.com/solodev/aws/master/pages/images/solodev-launch-btn.png" width="200" alt="Launch Private OpenAPI MCP" /></a>

Provide these values in the CloudFormation form:

| Parameter | Guidance |
|---|---|
| `VpcId` | VPC that can reach the target API |
| `LoadBalancerSubnets` | Two or more subnets for the ALB |
| `ServiceSubnets` | Private subnets with NAT access, or public subnets when testing with public IPs |
| `OpenApiUrl` | Reachable OpenAPI/Swagger JSON or YAML URL |
| `ApiBaseUrl` | Base URL generated tools will call |
| `OpenApiAuthToken` | Optional target API bearer token |
| `McpAuthToken` | Optional bearer token required from MCP clients |
| `AllowedTools` | Optional comma-separated tool allowlist |

Leave `InternalLoadBalancer` set to `true` for a private service. Add an ACM
certificate to use HTTPS. The stack outputs the MCP URL; append `/mcp` when
configuring a client. Use the `IngressCidr` value to limit which network can
reach the load balancer. For production, move tokens into the customer's
Secrets Manager/ECS secret integration after the initial smoke test.

## AWS Marketplace And AgentCore Runtime

1. Subscribe to **OpenAPI MCP** in AWS Marketplace and select the
   **Container image** delivery method for **Bedrock AgentCore**.
2. Create an AgentCore Runtime from the subscribed image, or launch the
   [product CloudFormation template](./devops/cloudformation/agentcore-runtime.yaml)
   from the repository's public CFT location.

Launch the published CloudFormation template in the AWS console:

[Subscribe to OpenAPI MCP in AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-g3jgkgokncmwi)

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

For a CMS API, use the CMS's OpenAPI document and API base URL. This works for
Solodev, WordPress, Drupal, and other platforms that publish a usable contract.
If a CMS provides a native MCP server with richer publishing or permission
workflows, compare that integration with generated OpenAPI tools.

### AgentCore console smoke test

In AWS, open **Amazon Bedrock AgentCore > Agents > Runtime**, select the
runtime, choose the `DEFAULT` endpoint, and select **Test**. The direct URL
shape is:

```text
https://<region>.console.aws.amazon.com/bedrock-agentcore/agents/<runtime-id>/test
```

For the current OpenAPI MCP smoke-test runtime, the direct link is:

<https://us-east-1.console.aws.amazon.com/bedrock-agentcore/agents/openapi_mcp_agentcore_test-d6Ng8r2BIa/test>

Leave **Session ID** blank for the first request. The AgentCore test panel
sends MCP JSON-RPC, not the generic `{"prompt":"..."}` example. Run these in
order:

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

When the runtime is configured with OpenADA's document and base URL, this
checks the live OpenADA API through the generated OpenAPI tool layer:

```json
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"execute-request","arguments":{"path":"/api/v1/directory","method":"GET"}}}
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
