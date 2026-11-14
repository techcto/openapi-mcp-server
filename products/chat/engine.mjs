import { McpHttpTransportService } from './mcp-transport.mjs';
const RESERVED_ARGUMENTS = new Set(['bearerToken', 'headers', 'authorization', 'auth_token']);
function modelSchema(schema) {
  const result = structuredClone(schema || { type: 'object', properties: {} });
  for (const key of RESERVED_ARGUMENTS) delete result.properties?.[key];
  if (Array.isArray(result.required)) result.required = result.required.filter(key => !RESERVED_ARGUMENTS.has(key));
  result.additionalProperties = false;
  return result;
}
const READ_NAME = /^(read|search|list|get)[-_.]/;
export class McpClient {
  constructor({ url, token = '', allowedTools = [], allowWrites = false }) {
    if (url) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) throw new Error('MCP must use an HTTPS endpoint.');
    }
    this.url = url; this.token = token; this.allowedTools = allowedTools; this.allowWrites = allowWrites;
  }
  async call(method, params) {
    return McpHttpTransportService.call({ url: this.url, authorization: this.token ? `Bearer ${this.token}` : '', method, params });
  }
  async tools() {
    if (!this.url) return [];
    let cursor, tools = [];
    for (let page = 0; page < 4; page++) {
      const result = await this.call('tools/list', cursor ? { cursor } : {});
      tools.push(...(Array.isArray(result?.tools) ? result.tools : [])); cursor = result?.nextCursor;
      if (!cursor) break;
    }
    return tools.filter(tool => /^[A-Za-z0-9_-]{1,64}$/.test(tool.name) && (!this.allowedTools.length || this.allowedTools.includes(tool.name)) && (this.allowWrites || (tool.annotations?.readOnlyHint !== false && (tool.annotations?.readOnlyHint === true || READ_NAME.test(tool.name))))).slice(0, 64).map(tool => ({ ...tool, inputSchema: modelSchema(tool.inputSchema) }));
  }
}

/** One model/tool loop for chat, search and explicitly activated autonomous work. */
export async function runAgent({ prompt, history = [], type = 'chat', activated = false }, { converse, mcp, modelId, instruction, allowAutonomous = false, maxTurns = 6 }) {
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000) throw new Error('Supply a prompt of 1–8000 characters.');
  if (!['chat', 'search', 'autonomous'].includes(type)) throw new Error('Unsupported agent type.');
  if (type === 'autonomous' && (!allowAutonomous || activated !== true)) throw new Error('Autonomous execution is not activated.');
  // Public chat/search never inherit write permissions from an autonomous-capable connection.
  mcp.allowWrites = type === 'autonomous' && allowAutonomous && activated;
  const tools = await mcp.tools(), approved = new Set(tools.map(tool => tool.name));
  const retained = history.slice(-32);
  while (retained.length && !(retained[0].role === 'user' && retained[0].content?.some(block => typeof block.text === 'string'))) retained.shift();
  const messages = [...retained, { role: 'user', content: [{ text: prompt.trim() }] }];
  const toolConfig = tools.length ? { tools: tools.map(tool => ({ toolSpec: { name: tool.name, description: String(tool.description || tool.name).slice(0, 2000), inputSchema: { json: tool.inputSchema || { type: 'object', properties: {} } } } })) } : undefined;
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  for (let turn = 0; turn <= maxTurns; turn++) {
    const response = await converse({ modelId, system: [{ text: instruction }], messages, inferenceConfig: { maxTokens: 4096, temperature: 0.2 }, ...(toolConfig && turn < maxTurns ? { toolConfig } : {}) });
    for (const key of Object.keys(usage)) {
      const value = response.usage?.[key];
      if (Number.isSafeInteger(value) && value >= 0) usage[key] += value;
    }
    const message = response.output?.message;
    if (!message || !Array.isArray(message.content)) throw new Error('The model returned an invalid response.');
    messages.push(message);
    if (response.stopReason !== 'tool_use') {
      return { text: message.content.map(block => block.text || '').join(''), history: messages.slice(-32), usage };
    }
    const results = [];
    for (const block of message.content) {
      if (!block.toolUse) continue;
      const tool = block.toolUse;
      if (!approved.has(tool.name) || turn >= maxTurns) throw new Error('The model requested an unavailable tool.');
      let result, status = 'success';
      try { result = await mcp.call('tools/call', { name: tool.name, arguments: Object.fromEntries(Object.entries(tool.input || {}).filter(([key]) => !RESERVED_ARGUMENTS.has(key))) }); if (result?.isError) status = 'error'; }
      catch { result = { error: 'The CMS tool failed. Review CMS permissions and retry.' }; status = 'error'; }
      results.push({ toolResult: { toolUseId: tool.toolUseId, status, content: [{ text: JSON.stringify(result).slice(0, 64000) }] } });
    }
    if (!results.length) throw new Error('No tool call was provided.');
    messages.push({ role: 'user', content: results });
  }
  throw new Error('The agent reached its bounded tool limit.');
}
