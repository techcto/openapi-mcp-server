# OpenAPI MCP on AppHub/Fargate or EKS

Run one MCP configuration per CMS/API. The container has one upstream URL,
schema and credential set; it is not a shared multi-tenant gateway.

## Choose a deployment

| Deployment | Resources | Endpoint |
| --- | --- | --- |
| CMS Fargate sidecar | Optional container in the CMS task, controlled by the CMS base template | CMS-authenticated `/mcp` gateway |
| AppHub MCP service | Separate per-CMS service on the existing AppHub cluster and listener | Dedicated HTTPS hostname, authenticated by an MCP bearer token |
| Standalone Fargate | Existing `private-ecs.yaml` creates a cluster and ALB | Dedicated private/public ALB |
| EKS | Per-CMS Deployment and internal Service from `devops/kubernetes/openapi-mcp.yaml` | Internal Service or an explicitly configured HTTPS ingress |

The AppHub service is an alternative to the in-task sidecar. Do not enable both
for the same CMS connection. AgentCore is a separate agent runtime that can
connect to the resulting MCP endpoint; it is not required to run this service.

## Marketplace image and access

Subscribe to the appropriate container delivery option and copy its **exact
versioned image URI** from the Marketplace launch instructions. The deployment
must use the image and architecture associated with that delivery option, not
a Docker Hub image or an assumed seller registry URI. Current OpenAPI MCP
release images are ARM64; an x86 CMS sidecar needs its separately built x86
image. Marketplace publication and availability are separate from these source
instructions; the currently published delivery option may list only AgentCore.

The release also publishes an independently tagged AMD64 image for Cloud's
verified image distribution. `cloud.yaml` selects that image and X86_64; it
imports a draft version until source approval and deployment tests pass.

The ECS task execution role or EKS node/Fargate execution role must be able to
pull that image. Subscription/repository access and IAM pull permissions are
both necessary. SpaceMade's approved private distribution path uses its own
verified image URI and repository grant instead of a customer subscription.

## AppHub/Fargate

Use `devops/cloudformation/apphub-ecs.yaml`. It creates only the MCP task,
service, security group, target group, host listener rule, logs and scoped
execution role. It reuses the existing cluster, VPC, subnets and HTTPS listener.
It creates no cluster, ALB, certificate, DNS zone or database.

1. Create two Secrets Manager secrets in the deployment Region: a random MCP
   client token, and the target CMS/API's bearer token. Use raw secret strings,
   not JSON documents. For a public API, omit the API secret. Keep token values
   out of command history; use the Secrets Manager console or your secret manager.
2. Select an unused hostname covered by the existing listener certificate and
   allocate a unique listener priority. Point that hostname's DNS at AppHub's
   ALB using your existing domain provisioning flow.
3. Fill in the existing AppHub connection values: `Cluster`, `VPCID`, `Subnets`,
   `LoadBalancerSecurityGroupId` and `ExistingListenerArn`. Set `HostName`,
   `ListenerPriority`, `OpenApiUrl`, `ApiBaseUrl` and `McpAuthSecretArn`.
   Set `ApiAuthSecretArn` when needed. Set `SecretsKmsKeyArn` only for a customer
   KMS key; its key policy must permit the execution role.
4. Set `CloudImageMcp` to the subscribed/approved versioned image and
   `CpuArchitecture` to its architecture. Default capacity is 0.5 vCPU/1 GiB.
5. Deploy using CloudFormation with `CAPABILITY_IAM`. With Cloud/AppHub, resolve
   host connection fields from the selected cluster rather than asking end
   users to type ARNs. No target API credential is shared between installations.
6. The task subnets need registry, Secrets Manager and CloudWatch access through
   NAT or appropriate VPC endpoints, plus connectivity to the target API. Private
   API security groups must allow traffic from the output
   `ServiceSecurityGroupId` on the API port. The template does not modify the
   shared API's security group. Keep `AssignPublicIp=DISABLED` for private subnets.
7. Wait for the service to become healthy. Test `HealthUrl`, then connect your
   MCP client to the output `McpUrl` with its MCP bearer token. API credentials
   remain server-side. DNS and certificate coverage must be working before testing.

A new task is required after changing a secret; use the normal service rollout.
Delete this application stack to remove its service and listener rule; shared
AppHub infrastructure and the supplied secrets remain owned by their original
stacks. Schedule scaling and availability according to the application's needs.

## EKS

Use a separate namespace/configuration for each CMS. The Kubernetes example is
private by default and does not grant the application access to AWS services.

1. Configure cluster access, image pull access and ARM64 worker capacity for the
   current delivery image (or change the node selector for a supplied AMD64 image).
2. Create the namespace and API settings:

   ```bash
   kubectl create namespace cms-mcp
   kubectl -n cms-mcp create configmap openapi-mcp \
     --from-literal=openapi-url=https://YOUR-CMS/API-SCHEMA-PATH \
     --from-literal=api-base-url=https://YOUR-CMS/API-BASE-PATH
   ```

   Use the CMS's actual OpenAPI and API URLs. Private service names are also
   supported when reachable from these pods.
3. Create the secret using protected local files, or your existing AWS Secrets
   Manager/Kubernetes secret integration. The API token file may be empty for a
   public API. Files must contain just the token without a trailing newline:

   ```bash
   kubectl -n cms-mcp create secret generic openapi-mcp-auth \
     --from-file=mcp-token=/PRIVATE/PATH/mcp-token \
     --from-file=api-token=/PRIVATE/PATH/api-token
   ```
4. Copy `devops/kubernetes/openapi-mcp.yaml`, replace
   `REPLACE_WITH_SUBSCRIBED_IMAGE_URI` with the exact Marketplace image URI,
   then deploy:

   ```bash
   kubectl -n cms-mcp apply -f openapi-mcp.yaml
   kubectl -n cms-mcp rollout status deployment/openapi-mcp
   kubectl -n cms-mcp port-forward service/openapi-mcp 8000:8000
   ```

5. Test `http://localhost:8000/health` and connect an MCP client to
   `http://localhost:8000/mcp`, sending the MCP bearer token. Port forwarding
   is a local smoke test. For external clients, configure your existing HTTPS
   ingress, DNS and certificate; preserve the Authorization header and allow
   MCP requests to complete. Do not expose the unauthenticated target API.
6. On shared EKS, apply namespace NetworkPolicies using your platform's actual
   ingress and API selectors to limit callers and upstream connectivity. The sample
   targets ARM64 worker nodes, not EKS Fargate. EKS Fargate requires a supported
   AMD64 delivery image and an appropriate profile instead.

For an actual sidecar in an existing CMS pod, keep the CMS chart as the source
of truth and use its supported MCP configuration. Do not patch running pods or
replace their Deployment with the standalone example above.

## References

- [AWS Marketplace container delivery options](https://docs.aws.amazon.com/marketplace/latest/userguide/container-based-products.html)
- [Marketplace container requirements](https://docs.aws.amazon.com/marketplace/latest/userguide/container-product-policies.html)
- [Task execution roles](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html)
