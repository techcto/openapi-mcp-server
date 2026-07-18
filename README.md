```
   ____                    _    ____ ___    __  __  ____ ____
  / __ \ _ __   ___ _ __  / \  |  _ \_ _|  |  \/  |/ ___|  _ \
 | |  | | '_ \ / _ \ '_ \/ _ \ | |_) | |   | |\/| | |   | |_) |
 | |__| | |_) |  __/ | | / ___ \|  __/| |   | |  | | |___|  __/
  \____/| .__/ \___|_| |_/_/   \_\_|  |___|  |_|  |_|\____|_|
        |_|
        turn any OpenAPI spec into MCP tools -- self-hosted, AWS Marketplace, or Bedrock AgentCore
```

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![AWS Marketplace](https://img.shields.io/badge/AWS%20Marketplace-Subscribe-orange)](#subscribe-on-aws-marketplace)
[![Protocol](https://img.shields.io/badge/protocol-Model%20Context%20Protocol-blueviolet)](https://modelcontextprotocol.io/)

A reusable [Model Context Protocol](https://modelcontextprotocol.io/) server that turns **any** OpenAPI or Swagger spec into:

- discovery tools for schema inspection
- generated execution tools for calling the underlying API
- HTTP, SSE, STDIO, and Amazon Bedrock AgentCore Runtime transports

This product is intentionally generic. Point it at a documented API and the
same server can front a CMS, WordPress, GitHub, Stripe, a government service,
or an internal business API without writing a custom MCP adapter. Most modern
SaaS platforms publish some form of Swagger or OpenAPI description, making the
API contract a practical bridge between business software and AI agents.

## Subscribe on AWS Marketplace

[Subscribe to OpenAPI MCP in AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-g3jgkgokncmwi)

OpenAPI MCP is delivered as a container image for **Amazon Bedrock AgentCore
Runtime**. After subscribing, AWS hosts and scales the MCP runtime for you;
the runtime remains stateless and each customer supplies the API it wants to
expose.

The listing may be private or under review while AWS completes publication.
Search AWS Marketplace for **OpenAPI MCP** and choose the listing whose
delivery method is **Container image** and whose compatible service is
**Bedrock AgentCore**.

Prefer to run it inside your own AWS account? See [Private OpenAPI MCP](#private-openapi-mcp) and the [Quick Start](./QUICKSTART.md).

## Public And Private Deployment

### Public OpenAPI MCP AgentCore

The public Marketplace path runs the ARM64 container on Amazon Bedrock
AgentCore Runtime. AWS supplies the runtime boundary, IAM/SigV4 invocation
controls, scaling, and session isolation. This is a good fit when the target
API is publicly reachable or is deliberately exposed through a secure API
gateway.

### Private OpenAPI MCP

Private OpenAPI MCP runs the same container in the customer's AWS account and
network boundary. Deploy it as an ECS service, EKS workload, or another
customer-managed container service, then point `OPENAPI_URL` and
`API_BASE_URL` at private DNS names or internal load balancers. Store
`OPENAPI_AUTH_TOKEN` and any MCP client credentials in AWS Secrets Manager or
the platform's equivalent secret store; do not bake them into an image or
commit them to a repository.

Use the private mode when the API is internal, the SaaS tenant data must stay
inside a customer boundary, the MCP endpoint must be reachable only through a
VPN or private network, or the organization needs its own logs, ingress,
scaling, and retention controls. The private service can still use AgentCore
as an AWS-authenticated front door when the customer's network design allows
that path; otherwise expose the service through the customer's own internal or
authenticated MCP endpoint.

For a guided ECS/Fargate deployment, launch the published private template:

<a href="https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?templateURL=https://openapi-mcp.s3.us-east-1.amazonaws.com/cloudformation/private-ecs.yaml&amp;stackName=openapi-mcp-private"><img src="https://raw.githubusercontent.com/solodev/aws/master/pages/images/solodev-launch-btn.png" width="200" alt="Launch Private OpenAPI MCP" /></a>

The template asks for a VPC, load balancer subnets, ECS service subnets, the
OpenAPI document URL, and the target API base URL. Keep the default internal
load balancer for private access. The ECS service needs NAT egress to pull the
Marketplace image when tasks have no public IP; use public service subnets and
`AssignPublicIp=ENABLED` only for a controlled test. Add an ACM certificate for
HTTPS and use the smallest trusted `IngressCidr` for clients.

The container is stateless. API schema and execution state come from the
configured target API, so private deployments do not require a separate
OpenAPI MCP database.

## Choose The Right Integration

OpenAPI MCP is the general-purpose option when an API already has an
OpenAPI/Swagger contract. Choose the integration style that matches the system
your agent needs to operate:

| Need | Product |
|---|---|
| Turn an arbitrary Swagger/OpenAPI document into MCP tools | **OpenAPI MCP AgentCore** (this repository) |
| Keep the MCP gateway and API traffic inside a customer AWS boundary | **Private OpenAPI MCP** using the same container |
| Give an agent native CMS workflows | A CMS-specific MCP server or connector |
| Integrate a system without an OpenAPI contract | A native MCP server or an adapter that publishes an OpenAPI contract |

For a CMS installation, use this product when you want generated tools from its
API contract. Solodev, WordPress, and Drupal are examples of CMS targets; the
same approach applies to CRM, ticketing, commerce, collaboration, Kubernetes,
DevOps, finance, and cloud APIs. Choose the private deployment when those APIs
or their credentials must not leave the customer's environment.

## What It Does

Point the server at an OpenAPI spec and it exposes:

- schema tools like `list-endpoints`, `get-endpoint`, and `search-schema`
- generated execution tools like `search-pages`, `publish-page`, or `create-ticket`
- a generic `execute-request` tool for calls the generator didn't anticipate

## Two Ways to Bring MCP Tools Into an Agent

This is the dimension that's new since the initial release: OpenAPI MCP tools can reach an agent from **either side** of the AWS boundary, and you can use one or both.

| | **Left side** -- orchestrator-side tools | **Right side** -- agent-native tools |
|---|---|---|
| Who calls the MCP server | The orchestrator platform (e.g. Osirus) calls it directly | The agent's own runtime code calls it, inside AWS |
| Where tool selection happens | Orchestrator's own tool-ranking/context logic | The foundation model's native tool-use loop (`Converse` + `toolConfig`) |
| What crosses the AWS boundary | Tool call results travel back to the orchestrator | Only the final synthesized answer leaves AWS |
| Best for | Flexibility, custom tool-selection logic, mixing tools from many sources | Data residency, minimal surface area, AWS-native deployments |
| How it's wired | Orchestrator holds a scoped IAM key and calls `InvokeAgentRuntime` itself | The agent's own execution role is granted `InvokeAgentRuntime` on this runtime's ARN |

Both sides call the exact same MCP server -- this repo doesn't know or care which one is calling it. See [Amazon Bedrock AgentCore Runtime](#amazon-bedrock-agentcore-runtime) below for the deployment mechanics either side needs.

## Quick Start

```bash
npm install

export OPENAPI_URL="https://petstore.swagger.io/v2/swagger.json"
export API_BASE_URL="https://petstore.swagger.io/v2"

npm start
```

Full walkthrough with more examples: [QUICKSTART.md](./QUICKSTART.md).

## Commit Requirements

This repo's Docker and CI flows expect both `package.json` and `package-lock.json` to be present in the build context.

- Commit `package-lock.json` whenever dependencies change.
- Do not ignore the lockfile in Git.
- If Docker reports `COPY package.json package-lock.json ./: "/package-lock.json": not found`, the usual cause is that the lockfile exists only in a local working tree and was not committed.

Server endpoints:

- `GET /` info
- `GET /health`
- `GET /ping`
- `POST /mcp`
- `GET /sse`
- `GET /mcp/api/v1/u/:token/sse`
- `POST /tools/list`
- `POST /tools/call`
- `POST /call-tool`

## How To Use It

### 1. Run it against a target API

Example: a CMS or other OpenAPI-documented service

```bash
export OPENAPI_URL="https://your-cms.example.com/mcp/openapi.json"
export API_BASE_URL="https://your-cms.example.com/api/v2"
export OPENAPI_AUTH_TOKEN="cms-api-bearer-token"
npm start
```

If a platform already provides a native MCP server, compare that integration's
domain-specific workflows with generated OpenAPI tools before choosing one.
OpenAPI MCP is the useful fallback when the API contract is the authoritative
integration surface.

Example: Zendesk

```bash
export OPENAPI_URL="https://your-proxy.example.com/zendesk/openapi.json"
export API_BASE_URL="https://your-subdomain.zendesk.com/api/v2"
export OPENAPI_AUTH_TOKEN="zendesk-api-token-or-proxy-token"
npm start
```

Example: WordPress

```bash
export OPENAPI_URL="https://your-wordpress.example.com/wp-json/openapi.json"
export API_BASE_URL="https://your-wordpress.example.com/wp-json"
export OPENAPI_AUTH_TOKEN="wp-api-token"
npm start
```

### Strong API targets

OpenAPI MCP is a useful starting point for APIs in these common business
categories:

- **CRM:** Salesforce, HubSpot, Microsoft Dynamics 365, and Zoho
- **Support and work management:** Zendesk, ServiceNow, Jira, and PagerDuty
- **Commerce and payments:** Shopify, WooCommerce, Stripe, Square, and Plaid
- **Content and collaboration:** Drupal, WordPress, Contentful, Slack, and Microsoft Graph
- **Engineering and platform operations:** GitHub, GitLab, Kubernetes, Argo CD, and cloud provider APIs

Availability and authentication vary by vendor. Use the vendor's current
OpenAPI document and follow its API terms, scopes, and rate limits.

### 2. Protect the MCP server itself

If you want Osirus, OpenAI tools, Claude, or another client to authenticate to this MCP server directly (self-hosted / left-side mode), set one or more MCP auth tokens:

```bash
export MCP_AUTH_TOKEN="shared-mcp-token"
```

Or:

```bash
export MCP_AUTH_TOKENS="token-a,token-b,token-c"
```

Then clients call the MCP server with:

```http
Authorization: Bearer shared-mcp-token
```

Claude-style SSE URLs also work:

```text
https://your-mcp.example.com/mcp/api/v1/u/shared-mcp-token/sse
```

On AgentCore Runtime, this layer is optional -- AgentCore's own IAM/SigV4 (or OAuth, if configured) already gates who can invoke the runtime at all.

### 3. Connect a client

#### HTTP MCP

```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer shared-mcp-token" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"tools/list",
    "params":{}
  }'
```

#### Legacy HTTP tool call

```bash
curl -X POST http://localhost:8000/tools/call \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer shared-mcp-token" \
  -d '{
    "name":"list-endpoints",
    "arguments":{}
  }'
```

#### Claude Desktop / STDIO

```json
{
  "mcpServers": {
    "openapi": {
      "command": "node",
      "args": ["/path/to/openapi-mcp-server/src/client.js"],
      "env": {
        "OPENAPI_URL": "https://your-api.example.com/openapi.json",
        "API_BASE_URL": "https://your-api.example.com",
        "OPENAPI_AUTH_TOKEN": "upstream-api-token"
      }
    }
  }
}
```

## Auth Model

Two separate token concerns, plus an optional third layer on AgentCore Runtime:

### 1. MCP server auth (self-hosted / left-side)

Protects access to the MCP server itself.

- `MCP_AUTH_TOKEN`
- `MCP_AUTH_TOKENS`
- optional `REQUIRE_AUTH=true|false`

If any MCP auth token is configured, auth is required by default.

### 2. Upstream API auth

The bearer token generated tools use when they call the underlying target API.

- `OPENAPI_AUTH_TOKEN`
- or `API_BEARER_TOKEN`

Schema loading from remote URLs also uses the upstream bearer token.

### 3. AgentCore Runtime invocation auth (right-side / hosted)

Who's allowed to call this runtime at all, gated entirely by AWS IAM -- see [Amazon Bedrock AgentCore Runtime](#amazon-bedrock-agentcore-runtime).

## Main Environment Variables

| Variable | Purpose |
|---|---|
| `OPENAPI_URL` | URL or local path to the OpenAPI/Swagger spec |
| `API_BASE_URL` | Base URL for execution tools |
| `OPENAPI_AUTH_TOKEN` | Bearer token for the upstream API |
| `API_BEARER_TOKEN` | Alternate name for upstream bearer token |
| `MCP_AUTH_TOKEN` | Single bearer token for protecting the MCP server |
| `MCP_AUTH_TOKENS` | Comma-separated list of valid MCP bearer tokens |
| `REQUIRE_AUTH` | Force on/off MCP auth requirement |
| `MCP_ALLOWED_TOOLS` | Comma-separated allowlist of exposed tool names |
| `PORT` | HTTP port (`8000` -- required for AgentCore Runtime) |
| `HOST` | Bind host (`0.0.0.0` -- required for AgentCore Runtime) |
| `PUBLIC_BASE_URL` | Public URL advertised in info output |
| `SERVER_NAME` | Optional display name |
| `SERVER_VERSION` | Optional display version |
| `SERVER_DESCRIPTION` | Optional display description |
| `CORS_ORIGIN` | Optional CORS origin override |

### Large APIs (100+ endpoints)

Foundation models don't do well with hundreds of tools in a single `toolConfig` -- accuracy drops and some providers hard-cap the count. A full CMS-scale OpenAPI spec can generate 500+ execution tools if left unfiltered.

**Set `MCP_ALLOWED_TOOLS` to a curated shortlist for any API this large.** This isn't just about trimming what the model sees -- disallowed tools are skipped *before* their schemas are even generated, so an unfiltered large spec also means unnecessary CPU/memory work on every cold start. Both the schema tools (`registerTools.js`) and the generated execution tools (`registerActions.js`) honor the allowlist at generation time, so it applies uniformly across every transport, including the native `/mcp` endpoint AgentCore Runtime calls.

## Tool Types

### Schema tools

- `list-endpoints`
- `get-endpoint`
- `get-request-body`
- `get-response-schema`
- `get-path-parameters`
- `list-components`
- `get-component`
- `list-security-schemes`
- `search-schema`

### Execution tools

Generated from paths and methods in the OpenAPI spec, for example:

- `search-pages`
- `create-page`
- `read-page`
- `update-page`
- `publish-page`

And always:

- `execute-request`

## Security Notes

- The MCP server auth token and upstream API token are intentionally separate.
- Reserved outbound headers like `Authorization`, `Host`, and `Content-Length` are stripped before proxying and rebuilt safely.
- Tool results are normalized to MCP `content` responses.
- Tool allowlisting is supported through `MCP_ALLOWED_TOOLS`.
- Do not expose admin-grade upstream tokens unless the API behind them is already scoped appropriately.
- Secrets used to invoke an AgentCore-hosted instance (AWS access keys) should never round-trip through a browser -- resolve them server-side only, from wherever your orchestrator stores credentials.

## Testing

```bash
npm test
npm run test:mcp
```

## Amazon Bedrock AgentCore Runtime

This server satisfies AgentCore Runtime's MCP server contract natively:

- Listens on `0.0.0.0:8000` (the `HOST`/`PORT` defaults already match this)
- `POST /mcp` runs the streamable-HTTP transport in stateless mode (`sessionIdGenerator: undefined`), so it doesn't reject the `Mcp-Session-Id` header AgentCore injects on every request
- `GET /ping` returns `{"status": "Healthy"}` for AgentCore's health checks
- The container image must be built for `linux/arm64` -- AgentCore Runtime only runs ARM64 containers

Test locally the same way AgentCore does before deploying:

```bash
docker run -p 8000:8000 <your-image>

curl http://localhost:8000/ping

curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

### Deploying to AgentCore Runtime

Two ways to get a running AgentCore Runtime hosting this image:

1. **Subscribe on AWS Marketplace** and choose the OpenAPI MCP listing whose delivery method is **Container image**. AWS then walks you through creating the runtime and filling in `OPENAPI_URL`/`API_BASE_URL`/`OPENAPI_AUTH_TOKEN`.
2. **Launch [`devops/cloudformation/agentcore-runtime.yaml`](./devops/cloudformation/agentcore-runtime.yaml) directly** -- a CloudFormation stack that provisions the runtime plus a scoped IAM user/key an orchestrator can use to invoke it (left-side mode). The customer walkthrough is [OpenAPI MCP Quickstart](./QUICKSTART.md); `cft.sh` is a developer helper for validating the template.

Either way, the output is a Runtime ARN (plus, from the CFT, a ready-to-paste `AccessKeyId`/`SecretAccessKey`/`Region` for left-side callers).

### Test in the AWS AgentCore console

Open **Amazon Bedrock AgentCore > Agents > Runtime**, select the runtime, pick
the `DEFAULT` endpoint, and choose **Test**. The direct URL format is:

```text
https://<region>.console.aws.amazon.com/bedrock-agentcore/agents/<runtime-id>/test
```

The current OpenAPI MCP smoke-test runtime can be opened at
<https://us-east-1.console.aws.amazon.com/bedrock-agentcore/agents/openapi_mcp_agentcore_test-d6Ng8r2BIa/test>.
Leave Session ID blank and paste the `initialize`, `tools/list`, and
`tools/call` JSON-RPC examples from [QUICKSTART.md](./QUICKSTART.md) in order.

### Left side vs. right side, concretely

- **Left side (orchestrator-side)**: hand the Runtime ARN + scoped AWS credentials to your orchestrator (e.g. paste into an Osirus "OpenAPI MCP" provider connection). The orchestrator calls `InvokeAgentRuntime` itself.
- **Right side (agent-native)**: grant *the agent's own* AgentCore Runtime execution role `bedrock-agentcore:InvokeAgentRuntime` on this MCP runtime's ARN (same AWS account -- no cross-account setup). The agent's own code discovers and calls tools natively via `Converse`'s `toolConfig`, and only ships the final answer out.

Reference: [Amazon Bedrock AgentCore Runtime for AWS Marketplace](https://docs.aws.amazon.com/marketplace/latest/userguide/bedrock-agentcore-runtime.html), [MCP protocol contract](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-mcp-protocol-contract.html).

## Release Checklist

- Verify `package-lock.json` is tracked before tagging a release.
- Check that example tokens in docs and tests are placeholders, not live credentials.
- Build the image for `linux/arm64` if this release will be used with AgentCore Runtime.
- A version tag runs the GitHub Actions release that builds the ARM64 image,
  publishes it to the Marketplace ECR repository, uploads the matching CFT,
  and submits the delivery-option changeset. End users do not need this
  release workflow; it is included here for maintainers.

## Project Structure

```text
src/
  server.js
  client.js
  config/
  middleware/
  routes/
  services/
  tools/
  utils/
devops/
  cloudformation/
    agentcore-runtime.yaml   # standalone AgentCore Runtime stack
    private-ecs.yaml          # private ECS/Fargate stack
  changeset.sh.dst           # AWS Marketplace changeset template
docs/
  marketplace-quickstart.md  # AWS Marketplace / AgentCore Runtime walkthrough
test/
samples/
git.sh                       # tag/retag release helper
cft.sh                        # local CloudFormation test-deploy helper
```

## License

MIT
