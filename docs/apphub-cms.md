# CMS MCP on AppHub

This product launches an independent CloudFormation root stack next to a selected CMS. Its version-pinned nested stack reuses the generic OpenAPI MCP AppHub service; the root owns its credentials.
It does not set `EnableMcp`, replace CMS tasks, create a cluster, or install AgentCore.
Its own stack owns the ECS service, task definition, credentials, logs, target group,
and hostname rule. Deleting it leaves the selected CMS and shared AppHub intact.

The CMS product base template is `cms-apphub-ecs.yaml`; its catalog manifest is `devops/catalog/cms-mcp-serverless.cloud.yaml`. The generic root `cloud.yaml` remains the OpenAPI MCP product. Both templates are published by the same release pipeline.

The template accepts the standard AppHub outputs (`VpcId`, `Cluster`, `ListenerArn`,
`LoadBalancerSecurityGroup`, `ServiceSubnets`). The existing HTTPS listener must
have a certificate covering the MCP hostname, and that hostname must resolve to
AppHub. Use an unused listener priority. Tasks need outbound access to ECR, Secrets
Manager, CloudWatch, and the CMS. Set CpuArchitecture to match the image. The Marketplace image is ARM64; the Cloud catalog currently pins the already published CMS 11.12.91 MCP component (X86_64) by digest, so no CMS rebuild or additional upstream pull grant is needed.

Connection settings come from the selected CMS's HTTPS origin. The upstream schema
is `/api/v2/system/swagger.json`; tool requests use `/api/v2`. This intentionally
does not depend on the CMS-hosted `/mcp/openapi.json`, which is disabled when the
CMS's optional built-in runtime is off.

Create a dedicated CMS API token under the CMS's Profile → API Tokens. Its user
permissions bound what generated tools can do. Supply a separate random MCP bearer
token and an explicit comma-separated allowlist of tools. Credentials are NoEcho
parameters stored in an installation-owned Secrets Manager secret and injected as
ECS secrets. Do not put them into URLs, parameter files, logs, or source control.
The MCP task has no AWS task role and cannot read other installations' secrets.

Portal checkout bills $29/month per selected CMS. One CMS's websites share that MCP
service. Cloud records the runtime as a normal Container and its catalog subscription,
bound to the verified checkout and selected CMS. It is not an AgentCore subscription.

Verification before activation:

1. Validate the template and create/review its change set.
2. Confirm the CMS stack has no changes and MCP uses the same account/AppHub.
3. Verify `/health`, unauthenticated MCP rejection, authenticated initialization,
   allowed-tool discovery, and rejection of unlisted tools.
4. Delete the MCP installation through its normal Cloud lifecycle, then verify the
   CMS website and sign-in still work.

The integration is not certified until those deployment checks pass.
