import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const c = new Client({ name: 'smoke', version: '0' });
await c.connect(new StreamableHTTPClientTransport(new URL(process.env.URL ?? 'http://localhost:8080/mcp')));
const r: any = await c.callTool({ name: 'get_kpi_value', arguments: { demoId: 'demo-weather', decisions: { 'wx-gate': 'regate-c' } } });
console.log((await c.listTools()).tools.length, 'tools;', r.content[0].text.slice(0, 200));
await c.close();
