import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import yaml from 'js-yaml';
const names=['Ref','Sub','GetAtt','Equals','Not','If','And','Or','Condition','Contains','Join'];
const tags=names.flatMap(name=>['scalar','sequence'].map(kind=>new yaml.Type('!'+name,{kind,construct:value=>({[name]:value})})));
const read=name=>yaml.load(readFileSync(new URL('../devops/cloudformation/'+name,import.meta.url),'utf8'),{schema:yaml.DEFAULT_SCHEMA.extend(tags)});
for(const name of ['agentcore-runtime.yaml','agentcore-chat.yaml']) test(`${name} owns its VPC access rule without owning CMS resources`,()=>{
 const t=read(name);
 assert.deepEqual(t.Parameters.NetworkMode.AllowedValues,['PUBLIC','VPC']);
 assert.equal(t.Resources.AgentCoreSecurityGroup.Type,'AWS::EC2::SecurityGroup');
 assert.equal(t.Resources.CmsRuntimeIngress.Condition,'ConnectCmsGroup');
 assert.deepEqual(t.Resources.CmsRuntimeIngress.Properties.GroupId,{Ref:'CmsSecurityGroupId'});
 assert.deepEqual(t.Resources.CmsRuntimeIngress.Properties.SourceSecurityGroupId,{Ref:'AgentCoreSecurityGroup'});
 assert(!Object.values(t.Resources).some(r=>r.Type==='AWS::EC2::VPC'));
 assert.equal(t.Parameters.CmsPort.Default,443);
});
test('MCP custom resource sends VPC config on create/update, PUBLIC remains compatible, invalid networks fail closed',()=>{
 const code=read('agentcore-runtime.yaml').Resources.RuntimeProvisionerFunction.Properties.Code.ZipFile;
 const program=`import sys,json,types
from unittest.mock import Mock,patch
code=json.load(sys.stdin)
calls=[]
control=Mock()
control.create_agent_runtime.side_effect=lambda **kw: calls.append(kw) or {'agentRuntimeArn':'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/test'}
control.update_agent_runtime.side_effect=lambda **kw: calls.append(kw) or {'agentRuntimeArn':'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/test'}
iam=Mock(); iam.exceptions.InvalidInputException=type('InvalidInputException',(Exception,),{})
sys.modules['boto3']=types.SimpleNamespace(client=lambda service,**kwargs: iam if service=='iam' else control)
ns={};exec(code,ns)
responses=[]
ns['send']=lambda event,ctx,status,data=None,physical_id=None,**kw: responses.append(status)
ctx=types.SimpleNamespace(log_stream_name='test')
base={'StackId':'stack','RequestId':'request','LogicalResourceId':'Runtime','ResponseURL':'https://local.invalid/response','PhysicalResourceId':'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/test'}
props={'Region':'us-east-1','AgentName':'test','RoleArn':'role','ContainerUri':'image','AgentDescription':'test','EnvironmentVariables':{},'NetworkMode':'VPC','RuntimeSubnets':['subnet-ab12'],'RuntimeSecurityGroups':['sg-ab12']}
for kind in ['Create','Update']:
 ns['handler'](dict(base,RequestType=kind,ResourceProperties=props),ctx)
 assert calls[-1]['networkConfiguration']=={'networkMode':'VPC','networkModeConfig':{'subnets':['subnet-ab12'],'securityGroups':['sg-ab12']}},calls
ns['handler'](dict(base,RequestType='Update',ResourceProperties=dict(props,NetworkMode='PUBLIC')),ctx)
assert calls[-1]['networkConfiguration']=={'networkMode':'PUBLIC'}
count=len(calls)
ns['handler'](dict(base,RequestType='Create',ResourceProperties=dict(props,RuntimeSubnets=[])),ctx)
assert len(calls)==count
assert responses[-1]=='FAILED',responses
class Missing(Exception):
 response={'Error':{'Code':'ResourceNotFoundException'}}
control.get_agent_runtime.side_effect=Missing()
ns['handler'](dict(base,RequestType='Delete',ResourceProperties=dict(props,RuntimeSubnets=[])),ctx)
assert responses[-1]=='SUCCESS',responses
assert control.delete_agent_runtime.call_count==1
control.delete_agent_runtime.side_effect=RuntimeError('Access denied')
ns['handler'](dict(base,RequestType='Delete',ResourceProperties=props),ctx)
assert responses[-1]=='FAILED',responses

print('PASS create/update VPC, public compatibility, missing-network rejection')`;
 const result=execFileSync('python3',['-c',program],{input:JSON.stringify(code),encoding:'utf8'});
 assert.match(result,/PASS create\/update VPC/);
});
