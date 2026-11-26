# AgentCore OpenAPI MCP & Chat

**Turn your APIs into agent tools. Bring your website content into AI chat.**

Two AWS Marketplace products, built for Amazon Bedrock AgentCore and deployed in
your AWS account. **OpenAPI MCP** turns an API specification into callable tools.
**AgentCore Chat** runs the model and tool loop that answers questions using your
live MCP content. Use either product on its own, or connect them together.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![AWS Marketplace](https://img.shields.io/badge/AWS%20Marketplace-Two%20products-orange)](#choose-your-product)
[![Protocol](https://img.shields.io/badge/protocol-Model%20Context%20Protocol-blueviolet)](https://modelcontextprotocol.io/)

## Choose your product

<table>
<tr>
<td width="50%" valign="top">
<h3>OpenAPI MCP</h3>
<p><strong>Give agents tools for your APIs.</strong></p>
<p>Turn an OpenAPI or Swagger document into tools that agents can discover and
call. Connect a CMS, business application or internal API without building a
custom MCP adapter.</p>
<ul>
<li>Generated API discovery and execution tools</li>
<li>Public or VPC access to your target API</li>
<li>AgentCore, private ECS/Fargate, AppHub and EKS delivery options</li>
</ul>
<p><a href="https://aws.amazon.com/marketplace/pp/prodview-g3jgkgokncmwi"><strong>Subscribe on AWS Marketplace</strong></a></p>
<p><a href="https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https%3A%2F%2Fopenapi-mcp.s3.us-east-1.amazonaws.com%2Fcloudformation%2F0.1.14%2Fagentcore-runtime-marketplace.yaml&amp;stackName=openapi-mcp-agentcore"><img src="docs/images/launch-cloudformation.svg" width="220" height="44" alt="Launch OpenAPI MCP CloudFormation stack on AWS" /></a></p>
<p><a href="docs/marketplace-quickstart.md">Read the MCP quick start →</a></p>
</td>
<td width="50%" valign="top">
<h3>AgentCore Chat</h3>
<p><strong>Answer website questions with live MCP content.</strong></p>
<p>Run an AI chat agent in your AWS account, with Amazon Bedrock model calls,
authenticated MCP context and an HTTPS chat API for your website. Connect
OpenAPI MCP or another compatible MCP service.</p>
<ul>
<li>Standalone runtime, chat gateway and website API</li>
<li>Read-only website chat with public or authenticated user access</li>
<li>Public or VPC access to your CMS/MCP service</li>
</ul>
<p><a href="https://aws.amazon.com/marketplace/pp?sku=c2tg5hj6k3lq7hwvqs1qszlhx"><strong>Subscribe on AWS Marketplace</strong></a></p>
<p><a href="https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https%3A%2F%2Fopenapi-mcp.s3.us-east-1.amazonaws.com%2Fcloudformation%2Fchat%2F0.1.14%2Fagentcore-chat-marketplace.yaml&amp;stackName=agentcore-chat"><img src="docs/images/launch-cloudformation.svg" width="220" height="44" alt="Launch AgentCore Chat CloudFormation stack on AWS" /></a></p>
<p><a href="docs/agentcore-chat-quickstart.md">Read the Chat quick start →</a></p>
</td>
</tr>
</table>

Subscribe to the matching product before launching its Marketplace image. The
buttons open the **v0.1.14 CloudFormation templates in us-east-1**. For another
release or delivery option, use the deployment link from its Marketplace listing.
AWS infrastructure, model usage and Marketplace charges apply to your account.

## How they work together

**Your API → OpenAPI MCP → AgentCore Chat → Your website**

OpenAPI MCP supplies the tools. Chat supplies the conversational model loop and
website API. Each service keeps its own configuration and credentials on the
server. A Chat deployment does not require an OpenSearch service or an Osirus
subscription, and it can use an existing MCP service instead of OpenAPI MCP.

Choose PUBLIC networking for internet-reachable APIs, or VPC networking for private
CMS/API access. Both require the appropriate service authentication, routes and
security-group permissions; the quick starts explain each configuration.

## Deploy and manage

1. **Subscribe** to MCP, Chat, or both through their individual Marketplace listings.
2. **Launch** the matching CloudFormation template and supply your API/MCP connection.
3. **Verify and connect** using that product's quick start and stack outputs.

For terminal-based stack management, both products use the same command:

```bash
# .env: PRODUCT=agentcore-mcp or PRODUCT=agentcore-chat
#       STACK_NAME, AWS_REGION, AWS_PROFILE and RELEASE_VERSION
bash cmd.sh install
bash cmd.sh update 0.1.15
bash cmd.sh events
```

`cmd.sh` calls `devops/cft.sh`. New stacks use CreateStack directly; version
updates use UPDATE change sets and retain existing credentials and networking.
See [stack management](docs/stack-management.md) for the complete `.env` setup and
initial parameter examples. Use a release that is published and accessible to
your account.

Every release tag builds both products and submits them to Marketplace. Approved
accounts can also use the private seller ECR distribution shared with SpaceMade;
image publication and Marketplace approval are separate steps.

## MCP runtime reference

The sections below cover the generic OpenAPI MCP server, transports, configuration
and development. For Chat deployment and its widget API, start with the
[Chat quick start](docs/agentcore-chat-quickstart.md) and
[technical reference](docs/agentcore-chat.md).

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

[Subscribe to OpenAPI MCP in AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-g3jgkgokncmwi)

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

Subscribe through AWS Marketplace and create the AgentCore Runtime from the
container image, or launch the published CloudFormation template below. The
customer walkthrough is [OpenAPI MCP Quickstart](./QUICKSTART.md).

[Subscribe to OpenAPI MCP in AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-g3jgkgokncmwi)

<a href="https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?templateURL=https://openapi-mcp.s3.us-east-1.amazonaws.com/cloudformation/agentcore-runtime.yaml&amp;stackName=openapi-mcp-agentcore"><img src="https://raw.githubusercontent.com/solodev/aws/master/pages/images/solodev-launch-btn.png" width="200" alt="Launch OpenAPI MCP AgentCore" /></a>

Either way, the output is a Runtime ARN (plus, from the CFT, a ready-to-paste `AccessKeyId`/`SecretAccessKey`/`Region` for left-side callers).

### Test in the AWS AgentCore console

Open **Amazon Bedrock AgentCore > Agents > Runtime**, select the runtime, pick
the `DEFAULT` endpoint, and choose **Test**. The direct URL format is:

```text
https://<region>.console.aws.amazon.com/bedrock-agentcore/agents/<runtime-id>/test
```

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
cmd.sh                        # .env-based stack install/update/status entry point
devops/cft.sh                 # CloudFormation command dispatcher
```

## License

MIT

## AppHub/Fargate and EKS deployment

See the [AppHub/Fargate and EKS quickstart](docs/fargate-eks-quickstart.md) for an existing-cluster Fargate template, private EKS manifests, secrets, image access, and per-CMS isolation.

### Runtime activity

CloudWatch receives structured `mcp.activity` events for HTTP requests and SSE
connections. Events contain correlation IDs, method/tool names, HTTP status and
duration. Arguments, results and authentication tokens are excluded. Portal's
service detail can tail this metadata on demand; leaving the tab pauses its live
view. MCP resource subscriptions are not advertised by this runtime.

### CMS-managed tools
The CMS AppHub product reads `/mcp/info` from its configured CMS. CMS provider settings control discovery and execution across Streamable HTTP, SSE and legacy endpoints; disabled or unavailable policy grants no tools. Public policy is cached for 15 seconds with coalesced reads. The dedicated CMS API token remains required for upstream operations. Generic OpenAPI installations retain their optional `MCP_ALLOWED_TOOLS` behavior when `CMS_MCP_POLICY_URL` is unset.
