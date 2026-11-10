import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { getToolsArray, parseToolArguments } from '../src/utils/toolUtils.js';
import { handleValidationError } from '../src/services/mcpMessageHandler.js';

test('tool discovery exposes the same nested schemas and optional fields as validation', () => {
  const tool = {schema: z.object({name:z.string(), headers:z.record(z.string(),z.string()).optional(), count:z.number().min(1).default(2)}),handler:()=>({})};
  const [published] = getToolsArray(new Map([['fixture',tool]]));
  assert.equal(published.inputSchema.properties.headers.type,'object');
  assert.equal(published.inputSchema.properties.headers.additionalProperties.type,'string');
  assert(published.inputSchema.required.includes('name'));
  assert(!published.inputSchema.required.includes('headers'));
  assert.equal(parseToolArguments(tool,{name:'CMS',headers:{accept:'application/json'}},'fixture').count,2);
});

test('invalid arguments return validation details without executing a tool', () => {
  const result=z.object({name:z.string()}).safeParse({name:42});
  const response=handleValidationError(result.error,7);
  assert.equal(response.error.code,-32602);
  assert(Array.isArray(response.error.data));
  assert.equal(response.error.data[0].path[0],'name');
});
