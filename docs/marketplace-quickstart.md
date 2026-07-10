# OpenAPI MCP Quickstart

OpenAPI MCP turns any OpenAPI or Swagger specification into a ready-to-use [Model Context Protocol](https://modelcontextprotocol.io/) tool server. Point it at an API's OpenAPI document and any MCP-compatible AI agent -- Amazon Bedrock AgentCore, Claude, or another MCP client -- gains search, create, read, and update tools for that API's resources, with no custom integration code to write.

This guide walks through subscribing to OpenAPI MCP on AWS Marketplace and deploying it against your own API.

## Prerequisites

Before you begin, you need:

- An AWS account with access to AWS Marketplace and Amazon Bedrock AgentCore Runtime (or an Amazon EKS cluster, if deploying there instead)
- An API with a published OpenAPI/Swagger specification (JSON or YAML) that OpenAPI MCP can read
- A bearer token or API key for that API, if its endpoints require authentication

## Step 1: Subscribe on AWS Marketplace

1. Open the OpenAPI MCP listing on AWS Marketplace.
2. Choose **Continue to Subscribe**, accept the terms, then choose **Continue to Configuration**.
3. Under **Delivery Method**, select **Container image**.
4. Choose **Continue to Launch**.

## Step 2: Deploy to Amazon Bedrock AgentCore Runtime

1. From the launch page, follow the link to create an AgentCore Runtime agent from the container image.
2. When prompted for environment variables, provide:

   | Variable | Description |
   |---|---|
   | `OPENAPI_URL` | URL to your target API's OpenAPI/Swagger specification |
   | `API_BASE_URL` | Base URL of the target API that generated tools should call |
   | `OPENAPI_AUTH_TOKEN` | Bearer token for the target API's protected endpoints, if required |

3. Complete the runtime creation. AgentCore Runtime will build and host the MCP server, exposing it at `POST /mcp` on port 8000.
4. Note the runtime ARN shown after creation -- you'll use it to invoke the server.

> OpenAPI MCP runs as a stateless streamable-HTTP MCP server, matching AgentCore Runtime's native MCP protocol contract. Each invocation is session-isolated by the runtime; no server-side session state is required.

## Step 3 (alternative): Deploy to Amazon EKS

If you'd rather self-host instead of using AgentCore Runtime, run the same container image as a standard deployment/service on your own EKS cluster, setting the same three environment variables. Route MCP client traffic to `POST /mcp` on port 8000.

## Step 4: Connect an MCP client

Using the AgentCore Runtime ARN (or your EKS-hosted URL), point any MCP client at the server and confirm the tool list loads:

```bash
curl -X POST https://<your-mcp-endpoint>/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

You should see a list of tools generated from your API's OpenAPI specification -- one or more per resource, covering search, create, read, and update operations where the spec defines them.

## Next Steps

- Restrict which tools are exposed with the `MCP_ALLOWED_TOOLS` environment variable.
- Protect the MCP server itself with `MCP_AUTH_TOKEN` (or `MCP_AUTH_TOKENS`) if it's reachable outside of AgentCore Runtime's own access controls.
- Solodev CMS customers: OpenAPI MCP ships with a pre-configured tool set for the Solodev CMS API out of the box -- see your CMS instance's Settings -> Providers -> MCP page for a ready-made `OPENAPI_URL` and connection token.

## See Also

- [Model Context Protocol specification](https://modelcontextprotocol.io/)
- [Amazon Bedrock AgentCore Runtime for AWS Marketplace](https://docs.aws.amazon.com/marketplace/latest/userguide/bedrock-agentcore-runtime.html)
- [Deploy MCP servers in AgentCore Runtime](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-mcp.html)
