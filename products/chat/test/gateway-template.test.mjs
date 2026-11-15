import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Chat Lambda invocation is restricted to the account and its widget API', () => {
  const template = readFileSync(new URL('../../../devops/cloudformation/agentcore-chat.yaml', import.meta.url), 'utf8');
  assert.doesNotMatch(template, /AWS::Lambda::Url|Principal:\s*['"]?\*/);
  assert.match(template, /Principal: apigateway.amazonaws.com/);
  assert.match(template, /SourceAccount: !Ref AWS::AccountId/);
  assert.match(template, /SourceArn: !Sub 'arn:\$\{AWS::Partition\}:execute-api:\$\{AWS::Region\}:\$\{AWS::AccountId\}:\$\{ChatApi\}\/\*'/);
  assert.match(template, /PayloadFormatVersion: '2.0'/);
  assert.match(template, /\$\{ChatApi.ApiEndpoint\}\/api/);
});

test('MCP provisioning Lambda has no public invocation grant or function URL', () => {
  const template = readFileSync(new URL('../../../devops/cloudformation/agentcore-runtime.yaml', import.meta.url), 'utf8');
  assert.doesNotMatch(template, /AWS::Lambda::Url|AWS::Lambda::Permission/);
});
