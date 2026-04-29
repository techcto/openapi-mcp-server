# OpenAPI MCP Server

A reusable MCP server that turns any OpenAPI or Swagger spec into:

- discovery tools for schema inspection
- execution tools for calling the underlying API
- HTTP and STDIO transports for OpenAI, Claude, Osirus, and other MCP clients

This repo is intentionally generic. CMS is one target, but the same server can front Zendesk, WordPress, internal APIs, and other OpenAPI-backed systems.

## What It Does

Point the server at an OpenAPI spec and it will expose:

- schema tools like `list-endpoints`, `get-endpoint`, and `search-schema`
- generated execution tools like `search-users`, `create-post`, or `delete-ticket`
- a generic `execute-request` tool for custom calls

## Quick Start

```bash
npm install

export OPENAPI_URL="https://petstore.swagger.io/v2/swagger.json"
export API_BASE_URL="https://petstore.swagger.io/v2"

npm start
```

Server endpoints:

- `GET /` info
- `GET /health`
- `POST /mcp`
- `GET /sse`
- `GET /mcp/api/v1/u/:token/sse`
- `POST /tools/list`
- `POST /tools/call`
- `POST /call-tool`

## How To Use It

### 1. Run it against a target API

Example: CMS

```bash
export OPENAPI_URL="https://your-cms.example.com/public/api/system/swagger.json"
export API_BASE_URL="https://your-cms.example.com/public/api"
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

If you want Osirus, OpenAI tools, Claude, or another client to authenticate to this MCP server, set one or more MCP auth tokens:

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

There are two separate token concerns:

### 1. MCP server auth

This protects access to the MCP server itself.

Use:

- `MCP_AUTH_TOKEN`
- `MCP_AUTH_TOKENS`
- optional `REQUIRE_AUTH=true|false`

If any MCP auth token is configured, auth is required by default.

### 2. Upstream API auth

This is the bearer token the generated tools use when they call the underlying API.

Use:

- `OPENAPI_AUTH_TOKEN`
- or `API_BEARER_TOKEN`

Schema loading from remote URLs also uses the upstream bearer token.

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
| `PORT` | HTTP port |
| `HOST` | Bind host |
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

- `search-users`
- `create-user`
- `read-user`
- `update-user`
- `delete-user`

And always:

- `execute-request`

## Security Notes

- The MCP server auth token and upstream API token are intentionally separate.
- Reserved outbound headers like `Authorization`, `Host`, and `Content-Length` are stripped before proxying and rebuilt safely.
- Tool results are normalized to MCP `content` responses.
- Tool allowlisting is supported through `MCP_ALLOWED_TOOLS`.
- Do not expose admin-grade upstream tokens unless the API behind them is already scoped appropriately.

## Testing

```bash
npm test
npm run test:mcp
```

## Recommended Product Use

### Do I need a CMS provider?

Not to run this repo by itself.

You only need env vars to run the server directly.

But yes, if you want this to become a real Solodev product feature, we should add a CMS provider so admins can manage:

- MCP server URL
- MCP auth token
- upstream OpenAPI URL
- upstream API bearer token
- allowed tools
- policy prompts / guardrails

That provider should be generic, not CMS-only, so the same CMS UI can register:

- Solodev MCP
- Zendesk MCP
- WordPress MCP
- other OpenAPI MCP connections

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
test/
samples/
```

## License

MIT
