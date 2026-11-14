# Solodev AgentCore Chat

Two independent products share this repository:

| Product | Purpose | Release tag |
|---|---|---|
| OpenAPI MCP / AgentCore MCP | Expose an API as MCP tools | `v*` (existing pipeline) |
| Solodev AgentCore Chat | Run a model/tool loop and serve a website widget | `chat-v*` |

Chat is a small standalone harness, not an Osirus deployment. It runs inside
Amazon Bedrock AgentCore in the customer's AWS account and reads live CMS
context through an authenticated MCP endpoint. No OpenSearch or Osirus key is
required. The widget remains static S3/CDN JavaScript; credentials stay in AWS.

## Test before Marketplace

Push `chat-v0.1.0` or manually run **Build AgentCore Chat**. Normal builds publish
seller ECR images, the gateway ZIP and versioned CFT without submitting to
Marketplace. ARM64 uses `solodev/agentcore-chat:0.1.0`; AMD64 uses
`solodev/agentcore-chat:0.1.0-amd64`. The existing publication script grants
SpaceMade pull-only access. A consuming task role must also permit ECR pulls.

The published template is:
`https://openapi-mcp.s3.us-east-1.amazonaws.com/cloudformation/chat/0.1.0/agentcore-chat.yaml`.
Deploy in us-east-1 using a reviewed CloudFormation change set. Other Regions
require the ZIP and image to be available in that Region.

Supply:
- `McpUrl`: the CMS/native or standalone MCP HTTPS endpoint.
- `McpCredentialSecretArn`: a same-Region secret containing `{"token":"..."}`.
- `AllowedOrigins`: exact website origins, separated by commas.
- `OidcIssuer` and `OidcAudience` for authenticated chat, or explicitly select
  `PublicChat=true` for anonymous, read-only website chat.

The stack creates the AgentCore runtime, execution role, a small Lambda widget
API and private session-signing secret. It outputs `RuntimeArn` and `ChatApiUrl`.
It creates no IAM users or long-lived AWS access keys.

The gateway's URL is public network connectivity; application authentication
is enforced independently. It does not make a private network endpoint publicly
reachable. For a private CMS, choose `NetworkMode=VPC`, supply `RuntimeSubnets` and
`RuntimeSecurityGroups` from the connected AppHub, and allow HTTPS from that
security group to the CMS MCP endpoint. These subnets need private endpoints
or existing NAT access for required AWS APIs. No public CMS exposure is needed.
The template does not create or modify the customer's networking.

## Widget

For an anonymous public deployment, the current widget's existing API contract
is supported:

```javascript
OsirusAgent.init({ agentId: 'chat', baseApiUrl: 'CHAT_API_URL', mode: 'chat' });
```

The SDK's exported symbol is currently `OsirusAgent`; the displayed provider is
Solodev AI or Amazon Bedrock AgentCore. Private chat must send the signed-in
user's OIDC access token. The widget needs an authenticated transport adapter
before its default API client can be used with that mode; never embed an AWS
access key or CMS token in a widget snippet.

This first gateway returns complete JSON replies supported by the widget. It
does not claim token-by-token streaming. Conversations keep bounded, temporary
history in the AgentCore session; this is not a durable chat archive.

## Agent types and activation

- Chat: site-wide widget; reads only approved read-only CMS tools.
- Search: the same read-only context loop, for a selected page placement.
- Autonomous: an explicitly activated private execution workflow. Both
  `EnableAutonomous=true` and invocation `type=autonomous, activated=true` are
  required. It may use write tools enabled by the CMS and deployment allowlist.
  The anonymous widget gateway always invokes Chat and cannot activate it.

An autonomous invocation can build or migrate CMS content, or run a spelling
and automated accessibility review using the installed tools. Editing and
publishing permissions remain separate from read-only audits. Long-running,
resumable jobs and browser accessibility scanners are not supplied by this
initial chat harness; they belong in the CMS run/provider workflow.

## Marketplace later

After creating the second product, configure GitHub repository variables:
`CHAT_MARKETPLACE_PRODUCT_ID` and `CHAT_MARKETPLACE_REPOSITORY` (full Marketplace
ECR repository URI). Product codes belong to that product's Marketplace setup;
none are invented here. Explicitly run the workflow with
`submit_marketplace=true` after testing the seller image. The submission script
promotes the tested image digest and submits the separate AGENT delivery option.

## CMS / Portal integration

CMS remains the owner of Agent_Workspace records and website/widget mappings.
Portal's Add Agent flow is CMS → Provider → Model → Type → Site/placement,
filtered by connected-provider capabilities. Chat maps site-wide, search maps
to selected pages and autonomous work has no automatic public widget. The
harness product and provider installation are independent of a CMS release;
this product does not itself install or configure the Portal/CMS provider UI.

## Osirus harness reuse

The gateway implements the existing Osirus widget API contract, including the
agent metadata and conversation/message response shapes. The MCP transport is
extracted from Osirus `mcp-http-transport.service.ts` (commit `72fe8b02`),
including initialization, session isolation and matching SSE responses without
waiting for an open stream to close. The standalone Bedrock loop keeps model
execution, CMS tool credentials and temporary conversation context in AWS.
No Osirus SaaS database, public API or OpenSearch service is required.

Agents are included in Portal plans. Solodev AI usage uses the managed payer;
customer-owned AgentCore invokes Bedrock in that AWS account and AWS bills it
there. Do not charge the same invocation through both providers.
