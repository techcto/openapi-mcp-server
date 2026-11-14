#!/usr/bin/env bash
set -euo pipefail
: "${CHAT_MARKETPLACE_PRODUCT_ID:?Set Chat's Marketplace product ID after creating the second product}"
: "${CHAT_MARKETPLACE_REPOSITORY:?Set Chat's Marketplace ECR repository after creating the second product}"
: "${RELEASE_VERSION:?Set the tested release version}"
: "${SELLER_REGISTRY:?Set the seller ECR registry}"
[[ "$CHAT_MARKETPLACE_PRODUCT_ID" =~ ^prod-[a-z0-9]+$ ]]
[[ "$CHAT_MARKETPLACE_REPOSITORY" =~ ^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/[a-z0-9/_-]+$ ]]
[[ "$RELEASE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
export CHAT_MARKETPLACE_PRODUCT_ID CHAT_MARKETPLACE_REPOSITORY RELEASE_VERSION
registry="${CHAT_MARKETPLACE_REPOSITORY%%/*}"
aws ecr get-login-password --region "${AWS_REGION:-us-east-1}" | docker login --username AWS --password-stdin "$registry"
digest=$(aws ecr describe-images --repository-name solodev/agentcore-chat --image-ids "imageTag=$RELEASE_VERSION" --query 'imageDetails[0].imageDigest' --output text)
docker buildx imagetools create --prefer-index=false --tag "$CHAT_MARKETPLACE_REPOSITORY:$RELEASE_VERSION" "$SELLER_REGISTRY/solodev/agentcore-chat@$digest"
published=$(aws ecr describe-images --registry-id "${registry%%.*}" --repository-name "${CHAT_MARKETPLACE_REPOSITORY#*/}" --image-ids "imageTag=$RELEASE_VERSION" --query 'imageDetails[0].imageDigest' --output text)
[[ "$published" == "$digest" ]] || { echo 'Marketplace image differs from tested seller image' >&2; exit 1; }
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
aws s3 cp "s3://openapi-mcp/cloudformation/chat/$RELEASE_VERSION/agentcore-chat.yaml" "$workdir/seller.yaml"
python3 - "$workdir/seller.yaml" "$workdir/marketplace.yaml" <<'PYT'
import os,pathlib,sys
repository=os.environ['CHAT_MARKETPLACE_REPOSITORY']
text=pathlib.Path(sys.argv[1]).read_text()
text=text.replace(os.environ['SELLER_REGISTRY']+'/solodev/agentcore-chat:',repository+':')
text=text.replace('arn:aws:ecr:us-east-1:'+os.environ['SELLER_REGISTRY'].split('.')[0]+':repository/solodev/agentcore-chat','arn:aws:ecr:us-east-1:'+repository.split('.')[0]+':repository/'+repository.split('/',1)[1])
pathlib.Path(sys.argv[2]).write_text(text)
PYT
aws s3 cp "$workdir/marketplace.yaml" "s3://openapi-mcp/cloudformation/chat/$RELEASE_VERSION/agentcore-chat-marketplace.yaml" --acl public-read
python3 - "$workdir/changeset.json" <<'PY'
import json,os,sys
version=os.environ['RELEASE_VERSION']
details={'Version':{'VersionTitle':version,'ReleaseNotes':f'Solodev AgentCore Chat {version}'},'DeliveryOptions':[{'DeliveryOptionTitle':'Amazon Bedrock AgentCore Chat','Details':{'EcrDeliveryOptionDetails':{'ContainerImages':[os.environ['CHAT_MARKETPLACE_REPOSITORY']+':'+version],'CompatibleServices':['Bedrock-AgentCore'],'AgenticType':['AGENT'],'Description':'A standalone Bedrock agent and website chat harness using CMS MCP context.','UsageInstructions':'https://github.com/techcto/openapi-mcp-server/blob/main/docs/agentcore-chat.md','DeploymentResources':[{'Name':'ChatCloudFormationTemplate','Url':f'https://openapi-mcp.s3.us-east-1.amazonaws.com/cloudformation/chat/{version}/agentcore-chat-marketplace.yaml'}]}}}]}
json.dump([{'ChangeType':'AddDeliveryOptions','Entity':{'Type':'ContainerProduct@1.0','Identifier':os.environ['CHAT_MARKETPLACE_PRODUCT_ID']},'Details':json.dumps(details)}],open(sys.argv[1],'w'))
PY
aws marketplace-catalog start-change-set --catalog AWSMarketplace --change-set "file://$workdir/changeset.json" --region us-east-1
