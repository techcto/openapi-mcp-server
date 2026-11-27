# Solodev AgentCore Chat

Start with the [AgentCore Chat quick start](agentcore-chat-quickstart.md) for
subscription, deployment, verification and website setup. This page is the
technical and release reference.

Both products share one release workflow and version:

| Product | Purpose | Release tag |
|---|---|---|
| OpenAPI MCP / AgentCore MCP | Expose an API as MCP tools | `v*` or `chat-v*` |
| Solodev AgentCore Chat | Run a model/tool loop and serve a website widget | `v*` or `chat-v*` |

Chat is a small standalone harness, not an Osirus deployment. It runs inside
Amazon Bedrock AgentCore in the customer's AWS account and reads live CMS
context through an authenticated MCP endpoint. No OpenSearch or Osirus key is
required. The widget remains static S3/CDN JavaScript; credentials stay in AWS.

## Release publication

Push one `vX.Y.Z` tag using `git.sh`. Each release publishes **both** OpenAPI MCP
and AgentCore Chat, including ARM64 and AMD64 seller ECR images, deployment
templates and the Chat gateway ZIP. ARM64 and AMD64 builds each run on native
GitHub runners rather than QEMU. Legacy `chat-vX.Y.Z` tags run the same workflow;
do not push both tag names for the same version.

Seller ECR grants SpaceMade account `317530278439` pull-only access. These private
images and the public deployment templates are usable without Marketplace approval.
The consuming task or runtime role must also permit the corresponding ECR pulls.

The workflow then promotes the same images and submits **both** Marketplace
products automatically. Submissions are separate jobs, so Marketplace review or a
submission failure does not block the direct seller artifacts. Manual workflow runs
can disable `submit_marketplace` for a direct-only release; tag releases always
submit both products.

Chat's direct template is:
`https://openapi-mcp.s3.us-east-1.amazonaws.com/cloudformation/chat/X.Y.Z/agentcore-chat.yaml`.
Its Marketplace template uses the `agentcore-chat-marketplace.yaml` suffix.
MCP direct templates use `cloudformation/X.Y.Z/<template>.yaml`; the Marketplace
copies use `<template>-marketplace.yaml` and point at the Marketplace registry.

Deploy in us-east-1. Other Regions require the ZIP and image in that Region.

Supply:
- `McpUrl`: the CMS/native or standalone MCP HTTPS endpoint.
- `McpCredentialSecretArn`: a same-Region secret containing `{"token":"..."}`.
- `AllowedOrigins`: HTTPS origins, separated by commas. `https://*.example.com` permits one subdomain level; list `https://example.com` separately for the apex.
- `OidcIssuer` and `OidcAudience` for authenticated chat, or explicitly select
  `PublicChat=true` for anonymous, read-only website chat.

The stack creates the AgentCore runtime, execution role, a small Lambda widget
API behind a throttled API Gateway HTTP API and private session-signing secret. It outputs `RuntimeArn` and `ChatApiUrl`.
It creates no IAM users or long-lived AWS access keys.

The widget API is publicly reachable; application authentication is enforced
independently. Lambda has no public Function URL or wildcard invocation grant:
only this account's API Gateway API may invoke it. The HTTP API has a 30-second
synchronous request limit; this widget endpoint is not a long-running job API.
After upgrading an existing stack, update the widget baseApiUrl to the new
ChatApiUrl output (the old Lambda Function URL is removed). It does not make a private network endpoint publicly
reachable. For a private CMS, choose `NetworkMode=VPC`, supply `RuntimeSubnets` and
`RuntimeSecurityGroups` from the connected AppHub, and allow HTTPS from that
security group to the CMS MCP endpoint. These subnets need private endpoints
or existing NAT access for required AWS APIs. No public CMS exposure is needed.
The template reuses the existing VPC and subnets and can create a runtime security
group plus a scoped CMS ingress rule. It does not create routes, NAT or service endpoints.

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

## AWS Marketplace

AgentCore Chat is a separate product from OpenAPI MCP:

- Product ID: `prod-csnnyvqmsdz5s`
- Product code: `c2tg5hj6k3lq7hwvqs1qszlhx`
- Marketplace repository: `709825985650.dkr.ecr.us-east-1.amazonaws.com/solodev/agentcore-chat`

The workflow defaults to this product and repository. Repository variables
`CHAT_MARKETPLACE_PRODUCT_ID` and `CHAT_MARKETPLACE_REPOSITORY` may override
these values. Every release tag promotes the same seller image digest and
submits the separate AGENT delivery option automatically, alongside the MCP
product. Submission does not launch a stack.

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

### Connect to the selected CMS VPC

Both AgentCore Chat and OpenAPI MCP accept the same network inputs:
`NetworkMode=VPC`, `VpcId`, `RuntimeSubnets`, optional `CmsSecurityGroupId`, and
`CmsPort` (443 by default). Portal discovers compatible settings from the owned
CMS/AppHub CloudFormation stack and preselects them in the AWS launch form.
The customer still reviews the change set and supplies API authentication in
secret fields. Credentials never belong in launch URLs.

With `VpcId`, the agent stack creates its own runtime security group. When a CMS
listener security group is supplied, the agent stack also owns a single ingress
rule from that runtime group to the selected port. Stack deletion removes that
rule; it does not delete the CMS, its VPC, subnets or existing security groups.
Existing Chat deployments can keep supplying `RuntimeSecurityGroups` directly.

VPC mode does not itself make an internet-facing CMS private. Use an API hostname
and trusted TLS certificate reachable from the selected subnets. Review DNS,
routes and target security rules. Container pulls need ECR and S3 connectivity;
Logs and model calls need their AWS endpoints or NAT. The stack does not create
NAT gateways or chargeable interface endpoints implicitly. For Regions other
than us-east-1, supply a same-Region ECR image. Shared Solodev hosting does not
expose its hosting VPC to a customer's account; use its authenticated public API.
