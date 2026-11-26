# Manage a product stack from this repository

`cmd.sh` calls `devops/cft.sh`, which runs the CloudFormation helper. Use the same
commands for OpenAPI MCP and AgentCore Chat, with a separate configuration for
each stack. This manages application stacks; it does not publish containers or
release tags.

Requires Bash, Node.js 22 or later and AWS CLI v2 with credentials for the target
AWS account. Run `bash cmd.sh help` for the command list.

## Configure the stack once

Copy `.env.example` to `.env`. Keep the file local; it is ignored by Git.
Set the stack's deployment controls:

```dotenv
PRODUCT=agentcore-mcp
STACK_NAME=my-openapi-mcp
AWS_REGION=us-east-1
AWS_PROFILE=my-aws-profile
RELEASE_VERSION=0.1.14
IMAGE_SOURCE=marketplace
CFT_PARAMETERS_FILE=.cft-parameters.json
```

- `STACK_NAME` is the exact CloudFormation stack to install or manage.
- `PRODUCT` is `agentcore-mcp` or `agentcore-chat`.
- `AWS_PROFILE` selects an existing AWS CLI profile. Leave it unset to use the
  normal credential chain, including CloudShell or workload role credentials.
- `RELEASE_VERSION` selects the published, immutable release to install/update.
  Supplying a version on the command line overrides this value.
- `IMAGE_SOURCE=marketplace` selects the Marketplace template and subscribed
  image. `seller` selects the direct seller template; your AWS account must have
  the repository pull grant and IAM access. Seller images are private.
- `CFT_PARAMETERS_FILE` names a JSON object with the **initial** template inputs.
  Keep its name under `.cft-parameters*.json` so Git ignores it.

Existing exported environment variables take precedence over `.env`. To keep
separate configurations, use `ENV_FILE=.env.chat bash cmd.sh status` or
`ENV_FILE=.env.mcp bash cmd.sh status`. These `.env.*` files are ignored too.
Relative configuration/parameter paths resolve from the repository directory.

### MCP initial parameters

Create `.cft-parameters.json` with your target API configuration, for example:

```json
{
  "OpenApiUrl": "https://petstore.swagger.io/v2/swagger.json",
  "ApiBaseUrl": "https://petstore.swagger.io/v2",
  "NetworkMode": "PUBLIC"
}
```

For a protected API, add `OpenApiAuthToken` and an appropriate `AllowedTools`
allowlist. Add VPC parameters when the API is private. See the
[OpenAPI MCP quick start](marketplace-quickstart.md) for the parameter contract.

### Chat initial parameters

For Chat, set `PRODUCT=agentcore-chat` and a different `STACK_NAME` in its env
file. Its JSON inputs can look like this:

```json
{
  "RuntimeName": "my_website_chat",
  "McpUrl": "https://cms.example.com/mcp",
  "McpCredentialSecretArn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:website-mcp-EXAMPLE",
  "AllowedOrigins": "https://www.example.com",
  "PublicChat": "true",
  "EnableAutonomous": "false",
  "NetworkMode": "PUBLIC"
}
```

Use the actual MCP URL and existing credential secret ARN. The secret contains
`{"token":"YOUR_MCP_TOKEN"}`. Give each runtime a unique `RuntimeName` in its
account. See the [Chat quick start](agentcore-chat-quickstart.md) for authenticated
Chat and VPC configuration.

## Install

```bash
bash cmd.sh install
# Or select an explicit published version:
bash cmd.sh install 0.1.14
```

Installation calls **CreateStack directly**. It starts deploying without a
change-set preparation/approval screen. Follow the stack with:

```bash
bash cmd.sh status
bash cmd.sh events
bash cmd.sh outputs
```

`outputs` omits access keys, tokens and passwords. Manage any required secret
outputs in your AWS console or secret manager.

## Update after a release tag

```bash
bash cmd.sh update 0.1.15
```

Use a version whose images/artifacts are published and accessible to the account.
The helper creates an **UPDATE change set**, displays the affected resources and
asks before execution. It keeps the deployed template and uses previous values
for the other parameters, including credentials and networking. Only the image tag
and, for Chat, `ArtifactKey=chat/<version>/gateway.zip` change. This keeps the Chat
container and gateway on the same release.

For separate planning and execution:

```bash
bash cmd.sh plan 0.1.15
bash cmd.sh apply 'arn:aws:cloudformation:us-east-1:123456789012:changeSet/NAME/ID'
```

Use the exact ARN printed by `plan`. In a non-interactive shell, `update` only
prints the plan; run `apply` after reviewing it. Monitor completion with `status`
and `events`.

These commands perform version updates. Template/resource changes still use the
normal CloudFormation template update lifecycle. If an older Portal deployment
wraps the product in a parent stack without `ContainerImageUri`, manage that
installation through Portal or its owning template; do not replace the parent
with an unrelated product template.
