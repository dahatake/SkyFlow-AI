import type { Express } from 'express';

// The engine reads the clock when it is first imported, so freeze it before loading anything that uses it.
if (process.env.ENGINE_CLOCK) {
  const { freezeClock } = await import('../../../app/src/domain/clock');
  freezeClock(process.env.ENGINE_CLOCK);
}

const { default: express } = await import('express');
const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createServer } = await import('./server.js');

export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => { res.json({ status: 'ok', service: 'skyflow-engine-mcp' }); });

  // Stateless: tools are pure, so each request gets its own server + transport.
  app.post('/mcp', async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { void transport.close(); void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      console.error('mcp request failed', e);
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  });
  const notAllowed = (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) =>
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
  app.get('/mcp', notAllowed);
  app.delete('/mcp', notAllowed);
  return app;
}

if (process.env.VITEST === undefined) {
  const port = Number(process.env.PORT ?? 8080);
  createApp().listen(port, () => console.log(`engine-mcp listening on :${port}`));
}
