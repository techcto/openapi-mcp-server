# OpenAPI MCP quick start

Turn an OpenAPI or Swagger document into MCP tools that agents can discover and
call. Deploy one configuration per target API. This product provides tools; it
does not run a chat model or install a website widget.

[Subscribe on AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-g3jgkgokncmwi)
· [AgentCore Chat quick start](agentcore-chat-quickstart.md)
· [AppHub/Fargate and EKS details](fargate-eks-quickstart.md)

## Before you start

- Have an AWS account permitted to subscribe and deploy the selected delivery
  option. The CloudFormation paths require permissions to create their IAM and
  application resources. AWS infrastructure and Marketplace charges apply.
- Start in **US East (N. Virginia), `us-east-1`**, where the release images and
  templates are published. Other Regions require the corresponding regional assets.
- Obtain your API's actual OpenAPI/Swagger JSON or YAML URL, API base URL, and
  bearer credential if needed. The runtime must be able to reach both URLs.
- Choose the tools the client is permitted to use. An OpenAPI document can describe
  write/delete operations as well as read operations; an empty allowlist exposes
  the generated tools permitted by the target API.

## 1. Subscribe and select a deployment

Subscribe to the listing and select the version and delivery option. Use the
versioned deployment resource linked from that option, together with its image.

| Delivery option | Use it when | Client connection |
|---|---|---|
| [Amazon Bedrock AgentCore](#agentcore) | You want an AWS-managed MCP runtime, with public or VPC access to the target API | Signed AgentCore invocation |
| [Private ECS/Fargate](#private-ecsfargate) | You want a dedicated container service and load balancer in your VPC | HTTPS MCP URL and MCP bearer token |
| [Existing AppHub ECS/Fargate](#existing-apphub-ecsfargate) | You already have an AppHub cluster and HTTPS listener | Dedicated hostname and MCP bearer token |
| [Amazon EKS](#amazon-eks) | You run workloads on an existing Kubernetes cluster | Internal service or your configured HTTPS ingress |

AgentCore uses the **ARM64** image. ECS/EKS must use worker/task architecture
matching the selected image; `-amd64` images require X86_64/AMD64 configuration.

SpaceMade's approved direct distribution pulls private seller ECR images shared
with its AWS account. That path does not wait for Marketplace approval. Public
CloudFormation URLs do not make their container images public, and sharing with
SpaceMade does not grant unrelated AWS accounts access automatically.

## 2. Configure the target API

These are two separate credentials:

| Setting | Purpose |
|---|---|
| `OpenApiUrl` / `OPENAPI_URL` | The API's schema URL, not its website home page |
| `ApiBaseUrl` / `API_BASE_URL` | Base URL used when executing generated tools |
| `OpenApiAuthToken` / `OPENAPI_AUTH_TOKEN` | Server-side bearer credential for the target API |
| `AllowedTools` / `MCP_ALLOWED_TOOLS` | Optional comma-separated allowed tool names |
| `McpAuthToken` / `MCP_AUTH_TOKEN` | Separate credential protecting a directly hosted MCP endpoint |

Use only credentials and API permissions appropriate to the tools you enable.
CloudFormation masks NoEcho parameters; AppHub uses secret ARNs. Never put the
upstream API credential in a website widget or client-side JavaScript.

## AgentCore

1. Open **AgentCoreCloudFormationTemplate** from the selected release's deployment
   resources and create a new CloudFormation stack.
2. Keep the release's `ContainerImageUri`, and supply `OpenApiUrl`, `ApiBaseUrl`,
   the upstream token if required, and the allowed tools.
3. For an internet-reachable API, leave `NetworkMode=PUBLIC`. For a private API,
   select `VPC` and provide `RuntimeSubnets` plus `VpcId` or existing
   `RuntimeSecurityGroups`. With `VpcId`, the stack owns its runtime group;
   `CmsSecurityGroupId` and `CmsPort` optionally create a scoped API access rule.
4. Ensure private networking has routes/DNS/TLS to the API and access to ECR, S3,
   CloudWatch and required AWS services through NAT or service endpoints. See
   [AWS VPC configuration](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-vpc.html).
5. Launch the stack and wait for **CREATE_COMPLETE**. Record `RuntimeArn`, `Region`
   and the invoker credentials from Outputs. Keep credentials in server-side
   connection settings or your secret manager.

The runtime uses AgentCore's MCP protocol and AWS IAM invocation boundary.
`NetworkMode=PUBLIC` describes outbound connectivity, not anonymous client access.
The container's internal `/mcp` listener is not a public unauthenticated URL.

### Verify the tools

Use the AgentCore console's runtime test interface with MCP JSON-RPC requests, or
an IAM-authenticated AgentCore MCP client. Initialize the session:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"quickstart","version":"1.0"}}}
```

Then request the tool list:

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
```

Expect the generated API tools permitted by your configuration. Call a returned
read-only tool with arguments matching its schema. AgentCore API calls require
AWS signing; a plain `curl` to `/mcp` is for directly hosted MCP, not a replacement
for the AgentCore authentication flow.

### Connect through Solodev Portal

Select **Agents → Add Agent**, your connected AWS account, its live CMS and
**MCP**. Confirm the Marketplace subscription, choose the network and click
**Launch**. After deployment, connect the outputs to the existing CMS MCP provider.
Portal resolves CMS credentials on the server and preserves permitted tools.
The single-Launch flow requires the corresponding Cloud/Portal launch update;
a container release alone does not upgrade an existing Portal.

## Private ECS/Fargate

Launch **PrivateEcsCloudFormationTemplate** from the selected release. Supply the
existing VPC, load-balancer/service subnets, API values, a separate MCP client token
and the trusted ingress CIDR. The template creates a dedicated cluster, service,
load balancer, security groups and logs; the load balancer is internal by default.
Configure its certificate/HTTPS listener for clients outside a trusted local network.

Wait for the service to become healthy, then use the stack's MCP endpoint. The
subnets need ECR, CloudWatch and target-API access. Use the ARM64 task image
specified by this delivery option. Detailed configuration is in the
[private deployment guide](fargate-eks-quickstart.md).

## Existing AppHub ECS/Fargate

Launch **AppHubCloudFormationTemplate**. Select the existing cluster, VPC, service
subnets, listener, hostname and unused listener priority. Supply `CloudImageMcp`
and matching `CpuArchitecture`, API configuration, `McpAuthSecretArn` and the
upstream API secret ARN if needed. These AppHub token secrets contain raw strings.

The application stack owns only its service, routing rule, security group and
related resources; it reuses the shared cluster and load balancer. Configure DNS
and ensure the listener certificate covers the hostname. Follow the
[AppHub guide](fargate-eks-quickstart.md#apphubfargate) for the exact input contract.

## Amazon EKS

Use **EksDeploymentManifest** from the selected delivery option with your existing
cluster. Set the exact subscribed image URI and matching node architecture;
configure the API URLs and token secrets. The manifest's service is internal by
default. Configure your own ingress, TLS and network access as required. Follow
the [EKS guide](fargate-eks-quickstart.md#eks) for the namespace, configuration and
verification commands.

## Verify directly hosted MCP

For ECS, AppHub or EKS, initialize an MCP client against the output HTTPS `McpUrl`
and configure its MCP bearer token. Request `tools/list`, then call a permitted
read-only tool. This endpoint uses its own MCP client token, not the target API's
token and not an AWS access key. The target API credential stays with the server.

## Troubleshooting

- **Image pull fails:** confirm the release URI, architecture, subscription or
  seller sharing grant, and the task/runtime/node role's ECR permissions.
- **Schema load fails:** check the actual schema URL, token, JSON/YAML content and
  connectivity. A CMS login or SSO redirect is not an OpenAPI document.
- **401/403:** check the appropriate credential: IAM for AgentCore invocation,
  the MCP token for hosted MCP, or the upstream API token for tool execution.
- **No tools or permission denied:** check the schema operations, API permissions,
  tool allowlist and any CMS provider policy.
- **Private API timeout:** verify VPC routes, DNS, TLS, runtime/API security groups
  and necessary AWS service endpoints. VPC selection alone does not establish access.
- **Stack failure:** open CloudFormation Events and the application CloudWatch
  logs. Resolve the reported error before retrying the normal deployment action.

For `.env`-based stack commands, see [stack management](stack-management.md).

## Upgrade or remove

Update the existing application stack using the selected version's template and
image while preserving API, secret and network settings. For EKS, apply the
matching manifest through your normal Kubernetes deployment process. Delete the
application stack or EKS workload to remove it; do not delete a shared AppHub,
VPC, CMS or separately managed secrets to remove one MCP connection.
