import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import yaml from 'js-yaml';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const tags=['Ref','Sub','GetAtt','Equals','Not','If'].flatMap(name=>['scalar','sequence'].map(kind=>new yaml.Type('!'+name,{kind,construct:value=>({[name]:value})})));
const template=yaml.load(read('devops/cloudformation/apphub-ecs.yaml'),{schema:yaml.DEFAULT_SCHEMA.extend(tags)});
test('AppHub reuses shared host resources and scopes routing to this installation',()=>{
 const resources=template.Resources;
 assert.equal(Object.values(resources).some(r=>['AWS::ECS::Cluster','AWS::ElasticLoadBalancingV2::LoadBalancer','AWS::RDS::DBInstance'].includes(r.Type)),false);
 assert.deepEqual(resources.Service.Properties.Cluster,{Ref:'Cluster'});
 assert.deepEqual(resources.ListenerRule.Properties.ListenerArn,{Ref:'ExistingListenerArn'});
 assert.deepEqual(resources.ListenerRule.Properties.Conditions,[{Field:'host-header',Values:[{Ref:'HostName'}]}]);
 assert.deepEqual(resources.ServiceSecurityGroup.Properties.SecurityGroupIngress[0].SourceSecurityGroupId,{Ref:'LoadBalancerSecurityGroupId'});
});
test('MCP requires authentication and uses installation secrets rather than template token values',()=>{
 const container=template.Resources.TaskDefinition.Properties.ContainerDefinitions[0];
 assert.equal(container.Environment.find(e=>e.Name==='REQUIRE_AUTH').Value,'true');
 assert.equal(container.Environment.some(e=>/TOKEN/.test(e.Name)),false);
 assert.deepEqual(container.Secrets[0],{Name:'MCP_AUTH_TOKEN',ValueFrom:{Ref:'McpAuthSecretArn'}});
 const policy=template.Resources.ExecutionRole.Properties.Policies[0].PolicyDocument.Statement[0];
 assert.equal(policy.Action,'secretsmanager:GetSecretValue');assert.equal(policy.Resource.includes('*'),false);
 assert.equal(template.Parameters.McpAuthSecretArn.Default,undefined);
});
test('Cloud image architecture matches the separately published AMD64 artifact',()=>{
 const manifest=yaml.load(read('cloud.yaml'))['catalog-items']['openapi-mcp'];const params=yaml.load(manifest.version.resource_params);
 assert.equal(manifest.version.version_status,'draft');
 assert.equal(params.build.find(p=>p.ParameterKey==='CpuArchitecture').ParameterValue,'X86_64');
 assert.match(params.distribution.cloud.images.mcp.source,/\$\{Git.Version\}-amd64$/);
 assert.equal(params.distribution.cloud.images.mcp.parameter,'CloudImageMcp');
 assert.ok(template.Parameters.CloudImageMcp);
 assert.ok(read('.github/workflows/release.yml').includes('platforms: linux/amd64'));
});
test('Marketplace delivery descriptors cover AgentCore, AppHub Fargate and EKS',()=>{
 const script=read('devops/changeset.sh.dst');const details=JSON.parse(script.split("DETAILS_JSON='")[1].split("';")[0]);
 assert.equal(details.DeliveryOptions.length,4);
 for(const title of ['Container image','Private ECS/Fargate','Existing AppHub ECS/Fargate','Amazon EKS'])assert.ok(details.DeliveryOptions.find(d=>d.DeliveryOptionTitle===title));
 const docs=yaml.loadAll(read('devops/kubernetes/openapi-mcp.yaml'));
 assert.equal(docs[1].spec.type,'ClusterIP');
 assert.equal(docs[0].spec.template.spec.containers[0].env.find(e=>e.name==='REQUIRE_AUTH').value,'true');
});
test('CMS product owns its credentials and reuses the generic AppHub runtime',()=>{
 const cms=yaml.load(read('devops/cloudformation/cms-apphub-ecs.yaml'),{schema:yaml.DEFAULT_SCHEMA.extend([...tags,new yaml.Type('!Join',{kind:'sequence',construct:value=>({Join:value})})])});
 assert.equal(cms.Resources.Runtime.Type,'AWS::CloudFormation::Stack');
 assert.match(cms.Resources.Runtime.Properties.TemplateURL,/cloudformation\/\{RELEASE_VERSION\}\/apphub-ecs.yaml$/);
 assert.equal(cms.Parameters.CmsApiToken.NoEcho,true);
 assert.equal(cms.Parameters.McpBearerToken.NoEcho,true);
 assert.deepEqual(cms.Resources.Runtime.Properties.Parameters.ApiAuthSecretArn,{Ref:'CmsApiCredential'});
 assert.equal(Object.values(cms.Resources).some(r=>r.Type==='AWS::ECS::Cluster'),false);
});

test('CMS catalog product consumes the independently released MCP image',()=>{
 const products=yaml.load(read('cloud.yaml'))['catalog-items'];
 const params=products['cms-mcp-serverless'].version.resource_params;
 assert.deepEqual(Object.keys(products),['openapi-mcp','cms-mcp-serverless']);
 assert.match(params.distribution.cloud.images.mcp.source,/solodev\/openapi-mcp:\$\{Git.Version\}-amd64$/);
 assert.equal(params.distribution.cloud.images.mcp.verify_revision,true);
 assert.equal(params.build.find(p=>p.ParameterKey==='CloudImageMcp').ParameterValue,params.distribution.cloud.images.mcp.source);
});
