# AgentCore Chat quick start

Deploy an AI chat agent in your AWS account, connect it to an authenticated MCP
service, and use the HTTPS chat API with your website. The runtime uses Amazon
Bedrock for model calls and MCP for live content. It does not require Osirus,
OpenSearch, or a separate CMS installation.

[Subscribe on AWS Marketplace](https://aws.amazon.com/marketplace/pp?sku=c2tg5hj6k3lq7hwvqs1qszlhx)
· [OpenAPI MCP quick start](marketplace-quickstart.md)
· [Technical reference](agentcore-chat.md)

## Before you start

- Use an AWS account permitted to subscribe to the product and deploy
  CloudFormation, IAM, AgentCore, Lambda, API Gateway and Secrets Manager resources.
- Start in **US East (N. Virginia), `us-east-1`**, where this release's images and
  gateway artifacts are published. Ensure the account can invoke the selected
  Amazon Bedrock model; the template defaults to Amazon Nova 2 Lite.
- Have an MCP HTTPS endpoint with the read-only tools and website content the
  agent should use. Obtain its bearer credential through the service that owns it.
- Have a same-Region Secrets Manager secret whose value is
  `{"token":"YOUR_MCP_BEARER_TOKEN"}`. Use an existing or CloudFormation-managed
  secret. The application reads the token on the server; it does not go in a widget.
- Know the exact website origins that will use Chat, such as
  `https://www.example.com`. AWS infrastructure, model usage and Marketplace
  charges apply to the deployment account.

## 1. Subscribe

Open the listing, accept the terms and select the release you want. Use that
release's **ChatCloudFormationTemplate** deployment link. This selects the
Marketplace image and matching gateway artifact for the same version.

SpaceMade's approved direct distribution uses seller ECR images with an account
pull grant instead. Those images are private, not public Docker images. Direct
image access does not depend on Marketplace review, but both the repository grant
and the runtime's IAM pull permissions must be in place.

## 2. Launch

### From Solodev Portal

1. Open **Agents → Add Agent** and choose your connected AWS account.
2. Select the live CMS in that account and choose **Chat**.
3. Confirm your Marketplace subscription, then choose the CMS website and network.
4. Enter the stack name, agent name and model, then choose **Launch**.
5. Follow the deployment progress screen. Portal supplies the CMS context and
   credentials on the server; you do not enter them in the browser form.

The single-Launch flow requires the corresponding Cloud/Portal launch update.
Publishing a container release alone does not upgrade an existing Portal.

### From AWS CloudFormation

Create a new stack using the selected release's Chat template. Choose a unique
stack name and a unique `RuntimeName`, such as `website_chat_production`.
Review these settings:

| Setting | What to supply |
|---|---|
| `McpUrl` | Your MCP service's HTTPS endpoint, including its MCP path |
| `McpCredentialSecretArn` | ARN of the secret containing the MCP token JSON |
| `AgentName`, `ModelId` | The displayed name and an available Bedrock model ID |
| `AllowedTools` | Optional comma-separated allowlist; Chat still permits only read-only tools |
| `AllowedOrigins` | Exact website origins, comma-separated, with no wildcard |
| `PublicChat` | `true` for anonymous read-only website chat; otherwise leave `false` |
| `OidcIssuer`, `OidcAudience` | Required when `PublicChat=false`; use your HTTPS OIDC issuer and audience |
| `EnableAutonomous` | Leave `false` for a website chat deployment |

Keep `ContainerImageUri`, `ImageRepositoryArn`, `ArtifactBucket` and `ArtifactKey`
at the selected release's values. Do not mix an image and gateway from different
versions. A normal CloudFormation create starts deployment immediately.

## 3. Choose the network

**PUBLIC** means the runtime can reach an internet-accessible MCP HTTPS endpoint.
It does not remove MCP authentication and does not automatically make Chat anonymous.

For a private CMS, select **VPC** and supply `RuntimeSubnets` in that CMS's VPC.
Set `VpcId` to let the stack create its runtime security group; optionally set
`CmsSecurityGroupId` and `CmsPort` so it also owns the narrowly scoped CMS ingress
rule. Alternatively, provide existing `RuntimeSecurityGroups` instead of `VpcId`.

Private subnets need routes and DNS/TLS that can reach the MCP service, plus
access to ECR, S3, Secrets Manager, CloudWatch and Bedrock through NAT or the
appropriate AWS service endpoints. The template reuses your network; it does not
create a VPC, NAT gateway or endpoints. See [AWS VPC configuration](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-vpc.html).

## 4. Verify and connect

Wait for the stack to reach **CREATE_COMPLETE**. Record `ChatApiUrl` and
`RuntimeArn` from Outputs.

For `PublicChat=true`, verify the agent metadata:

```bash
curl --fail --show-error "${CHAT_API_URL}/api/agents/chat"
```

Send a first message:

```bash
curl --fail --show-error \
  "${CHAT_API_URL}/api/agents/chat/chat/new/messages" \
  -H 'Content-Type: application/json' \
  --data '{"content":"What information is available on this website?"}'
```

Set `CHAT_API_URL` to the stack output. For authenticated Chat, include an
`Authorization: Bearer` header containing a valid user OIDC access token. For
browser calls, the website's Origin must match `AllowedOrigins`.

A successful reply includes `message.content` and a signed `chat.id`. Reuse that
chat ID in place of `new` for the next message; never substitute an AgentCore ARN,
AWS key, CMS credential or raw runtime session ID in a browser request.

In Portal, choose **Connect to CMS** after deployment, then finish activation in
normal Chat settings. For a standalone deployment, configure your website's
supported chat widget or API client with `ChatApiUrl`; see the [widget reference](agentcore-chat.md#widget).

## Troubleshooting

- **REVIEW_IN_PROGRESS:** the stack was prepared but not executed. Resume it with
  Portal's Launch action, or execute its existing deployment plan in CloudFormation.
- **Image pull/access error:** check the selected release, ARM64 image, repository
  access and runtime IAM permissions. Use the Marketplace image for subscribed
  accounts or the approved seller image for shared accounts.
- **401/403 from the chat API:** check `PublicChat`, the OIDC token, issuer/audience
  and exact allowed origin. CORS is not a replacement for authentication.
- **502 or unavailable content:** inspect the gateway and runtime CloudWatch logs;
  check model permissions, MCP reachability, token secret and enabled read-only tools.
- **VPC timeout:** check private DNS, routes, security groups and service endpoints.
  VPC mode alone does not establish access to the CMS.

## Upgrade or remove

Update the existing CloudFormation stack with a matching release template, image
and gateway artifact. Preserve your network, secret ARN and authentication values.
Delete the application stack to remove its runtime and gateway. A separately
managed MCP credential secret and your CMS/VPC remain owned by their original stacks.
