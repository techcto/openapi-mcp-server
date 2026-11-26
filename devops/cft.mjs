import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = resolve(root, process.env.ENV_FILE || '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const [command = 'help', argument] = process.argv.slice(2);
const help = `Usage: bash cmd.sh COMMAND [VERSION or CHANGE_SET_ARN]

Reads .env (or ENV_FILE); exported variables take precedence. Requires Node 22+
and AWS CLI v2. Set STACK_NAME, AWS_REGION, AWS_PROFILE and RELEASE_VERSION.
PRODUCT selects agentcore-mcp or agentcore-chat. IMAGE_SOURCE selects marketplace
or seller. CFT_PARAMETERS_FILE names the initial parameter JSON object.

  install [VERSION]    Create a new stack directly, without a change-set review
  update [VERSION]     Prepare/show an UPDATE change set, then confirm execution
  plan [VERSION]       Prepare/show an UPDATE change set without executing
  apply ARN           Execute an exact previously reviewed UPDATE change set
  status              Show stack status
  events              Show recent stack events
  outputs             Show non-secret connection outputs
  help                Show these instructions

Updates retain the deployed template and other parameters, including credentials
and networking. They change ContainerImageUri and Chat's versioned ArtifactKey.
No command builds images, pushes tags or submits to Marketplace.
See docs/stack-management.md for .env and parameter examples.`;
const fail = message => { throw new Error(message); };
function version(value) {
  const result = (value || process.env.RELEASE_VERSION || '').replace(/^(chat-)?v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(result)) fail('Set RELEASE_VERSION or supply an immutable version, such as 0.1.13.');
  return result;
}
function aws(...args) {
  const flags = ['--region', process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1', '--no-cli-pager', '--output', 'json'];
  if (process.env.AWS_PROFILE) flags.push('--profile', process.env.AWS_PROFILE);
  try {
    const output = execFileSync('aws', [...flags, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AWS_CLI_AUTO_PROMPT: 'off', AWS_PAGER: '' } });
    return output.trim() ? JSON.parse(output) : {};
  } catch (error) {
    const code = String(error.stderr || '').match(/An error occurred \(([^)]+)\)/)?.[1] || error.code || 'CliFailure';
    fail(`AWS ${args.slice(0, 2).join(' ')} failed (${code}). Check the account, permissions and stack events.`);
  }
}
function templateUrl(product, release) {
  const source = process.env.IMAGE_SOURCE || 'marketplace';
  if (!['marketplace', 'seller'].includes(source)) fail('IMAGE_SOURCE must be marketplace or seller.');
  const suffix = source === 'marketplace' ? '-marketplace' : '';
  return product === 'agentcore-chat'
    ? `https://openapi-mcp.s3.us-east-1.amazonaws.com/cloudformation/chat/${release}/agentcore-chat${suffix}.yaml`
    : `https://openapi-mcp.s3.us-east-1.amazonaws.com/cloudformation/${release}/agentcore-runtime${suffix}.yaml`;
}
function showPlan(plan) {
  console.log(JSON.stringify({ id: plan.ChangeSetId, stack: plan.StackName, status: plan.Status, reason: plan.StatusReason,
    changes: (plan.Changes || []).map(({ ResourceChange: c }) => ({ action: c.Action, resource: c.LogicalResourceId, type: c.ResourceType, replacement: c.Replacement })) }, null, 2));
}
async function main() {
  if (['help', '--help', '-h'].includes(command)) { console.log(help); return; }
  if (!['install', 'update', 'plan', 'apply', 'status', 'events', 'outputs'].includes(command)) fail('Unknown command. Run bash cmd.sh help.');
  const stackName = process.env.STACK_NAME;
  if (!stackName) fail('Set STACK_NAME in .env.');
  if (command === 'events') {
    const events = aws('cloudformation', 'describe-stack-events', '--stack-name', stackName).StackEvents || [];
    console.log(JSON.stringify(events.slice(0, 20).map(e => ({ time: e.Timestamp, resource: e.LogicalResourceId, status: e.ResourceStatus, reason: e.ResourceStatusReason })), null, 2)); return;
  }
  const directory = mkdtempSync(join(tmpdir(), 'openapi-mcp-cft-'));
  const file = join(directory, 'parameters.json');
  const saveParameters = values => { writeFileSync(file, JSON.stringify(values), { mode: 0o600 }); return 'file://' + file; };
  try {
    if (command === 'install') {
      const product = process.env.PRODUCT || 'agentcore-mcp';
      if (!['agentcore-mcp', 'agentcore-chat'].includes(product)) fail('PRODUCT must be agentcore-mcp or agentcore-chat.');
      const release = version(argument);
      let values = {};
      if (process.env.CFT_PARAMETERS_FILE) {
        try { values = JSON.parse(readFileSync(resolve(root, process.env.CFT_PARAMETERS_FILE), 'utf8')); }
        catch { fail('CFT_PARAMETERS_FILE must name a readable JSON object of template parameters.'); }
      }
      if (!values || Array.isArray(values) || typeof values !== 'object') fail('CFT_PARAMETERS_FILE must contain a JSON object.');
      const parameters = Object.entries(values).map(([ParameterKey, ParameterValue]) => ({ ParameterKey, ParameterValue: String(ParameterValue) }));
      const result = aws('cloudformation', 'create-stack', '--stack-name', stackName, '--template-url', templateUrl(product, release), '--capabilities', 'CAPABILITY_NAMED_IAM', '--parameters', saveParameters(parameters));
      console.log(JSON.stringify({ stack: result.StackId, status: 'CREATE_IN_PROGRESS' }, null, 2));
      console.log('Use bash cmd.sh events or bash cmd.sh status to follow deployment.'); return;
    }
    const stack = aws('cloudformation', 'describe-stacks', '--stack-name', stackName).Stacks?.[0];
    if (!stack) fail('Stack not found.');
    if (command === 'status') { console.log(JSON.stringify({ stack: stack.StackName, id: stack.StackId, status: stack.StackStatus }, null, 2)); return; }
    if (command === 'outputs') { console.log(JSON.stringify((stack.Outputs || []).filter(x => !/SecretAccessKey|AccessKeyId|Token|Password/i.test(x.OutputKey)), null, 2)); return; }
    let changeSet;
    if (command === 'apply') {
      if (!argument?.startsWith('arn:')) fail('Supply the exact change-set ARN from plan.');
      changeSet = aws('cloudformation', 'describe-change-set', '--stack-name', stack.StackId, '--change-set-name', argument);
    } else {
      const release = version(argument);
      const image = stack.Parameters?.find(p => p.ParameterKey === 'ContainerImageUri');
      if (!image) fail('This stack does not expose ContainerImageUri. Select the product stack that owns the runtime image.');
      if (!/\/solodev\/(openapi-mcp|agentcore-chat):[^@/]+$/.test(image.ParameterValue)) fail('The selected stack does not use an MCP/Chat release image.');
      const imageUri = image.ParameterValue.replace(/:[^/:]+$/, ':' + release + (image.ParameterValue.endsWith('-amd64') ? '-amd64' : ''));
      const parameters = stack.Parameters.map(p => p.ParameterKey === 'ContainerImageUri'
        ? { ParameterKey: p.ParameterKey, ParameterValue: imageUri }
        : p.ParameterKey === 'ArtifactKey' && imageUri.includes('/agentcore-chat:')
          ? { ParameterKey: p.ParameterKey, ParameterValue: `chat/${release}/gateway.zip` }
          : { ParameterKey: p.ParameterKey, UsePreviousValue: true });
      const result = aws('cloudformation', 'create-change-set', '--stack-name', stack.StackId, '--change-set-name', `release-${release.replaceAll('.', '-')}-${Date.now()}`, '--change-set-type', 'UPDATE', '--use-previous-template', '--capabilities', ...(stack.Capabilities || ['CAPABILITY_NAMED_IAM']), '--parameters', saveParameters(parameters));
      try { aws('cloudformation', 'wait', 'change-set-create-complete', '--stack-name', stack.StackId, '--change-set-name', result.Id); }
      catch { showPlan(aws('cloudformation', 'describe-change-set', '--stack-name', stack.StackId, '--change-set-name', result.Id)); process.exitCode = 1; return; }
      changeSet = aws('cloudformation', 'describe-change-set', '--stack-name', stack.StackId, '--change-set-name', result.Id);
    }
    showPlan(changeSet);
    if (changeSet.StackId !== stack.StackId || changeSet.ChangeSetType !== 'UPDATE' || changeSet.Status !== 'CREATE_COMPLETE' || changeSet.ExecutionStatus !== 'AVAILABLE') fail('The update is not ready to execute.');
    if (command === 'plan') return;
    if (command === 'update') {
      if (!process.stdin.isTTY) { console.log('No update executed. Review the plan, then use bash cmd.sh apply CHANGE_SET_ARN.'); return; }
      const input = createInterface({ input: process.stdin, output: process.stdout });
      let answer;
      try { answer = await input.question(`Execute this update for ${stack.StackName}? [y/N] `); } finally { input.close(); }
      if (answer.toLowerCase() !== 'y') return;
    }
    aws('cloudformation', 'execute-change-set', '--stack-name', stack.StackId, '--change-set-name', changeSet.ChangeSetId);
    console.log('Update started. Use bash cmd.sh events or bash cmd.sh status to follow it.');
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
