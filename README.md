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

This repo is intentionally generic. Solodev CMS is the flagship pre-configured integration, but the same server fronts Zendesk, WordPress, GitHub, Stripe, or any other OpenAPI-documented API with nothing more than three environment variables.

## Subscribe on AWS Marketplace

OpenAPI MCP is listed on AWS Marketplace as a container image for **Amazon Bedrock AgentCore Runtime** -- AWS hosts and scales it for you, session-isolated, no infrastructure to manage.

**[Subscribe on AWS Marketplace &rarr; TODO: paste the public listing URL here once visibility is public]**

Prefer to self-host instead? Skip straight to [Quick Start](./QUICKSTART.md) -- same image, runs anywhere Docker runs.

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

Example: Solodev CMS

```bash
export OPENAPI_URL="https://your-cms.example.com/mcp/openapi.json"
export API_BASE_URL="https://your-cms.example.com/api/v2"
export OPENAPI_AUTH_TOKEN="cms-api-bearer-token"
npm start
```

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

1. **Subscribe on AWS Marketplace** (link above) and use the launch flow -- AWS walks you through creating the runtime and filling in `OPENAPI_URL`/`API_BASE_URL`/`OPENAPI_AUTH_TOKEN`.
2. **Launch [`devops/cloudformation/agentcore-runtime.yaml`](./devops/cloudformation/agentcore-runtime.yaml) directly** -- a CloudFormation stack that provisions the runtime plus a scoped IAM user/key an orchestrator can use to invoke it (left-side mode). See [`devops/cloudformation/README`](#) or `cft.sh` for the CLI testing workflow used during development.

Either way, the output is a Runtime ARN (plus, from the CFT, a ready-to-paste `AccessKeyId`/`SecretAccessKey`/`Region` for left-side callers).

### Left side vs. right side, concretely

- **Left side (orchestrator-side)**: hand the Runtime ARN + scoped AWS credentials to your orchestrator (e.g. paste into an Osirus "OpenAPI MCP" provider connection). The orchestrator calls `InvokeAgentRuntime` itself.
- **Right side (agent-native)**: grant *the agent's own* AgentCore Runtime execution role `bedrock-agentcore:InvokeAgentRuntime` on this MCP runtime's ARN (same AWS account -- no cross-account setup). The agent's own code discovers and calls tools natively via `Converse`'s `toolConfig`, and only ships the final answer out.

Reference: [Amazon Bedrock AgentCore Runtime for AWS Marketplace](https://docs.aws.amazon.com/marketplace/latest/userguide/bedrock-agentcore-runtime.html), [MCP protocol contract](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-mcp-protocol-contract.html).

## Release Checklist

- Verify `package-lock.json` is tracked before tagging a release.
- Check that example tokens in docs and tests are placeholders, not live credentials.
- Build the image for `linux/arm64` if this release will be used with AgentCore Runtime.
- `./git.sh tag <version>` to cut a release; the GitHub Actions workflow builds, pushes to the Marketplace ECR repo, and submits the Marketplace changeset.

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
