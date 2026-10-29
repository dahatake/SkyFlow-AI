import { describe, expect, it } from 'vitest';
import { fabricProvider } from '../src/data/fabricProvider';
import { buildSeed } from '../src/domain/seed';

const resp = (body: unknown, ok = true, status = 200) => Promise.resolve({ ok, status, json: async () => body } as Response);

describe('fabric provider', () => {
  const base = { queryUri: 'https://x.kusto.fabric.microsoft.com/', database: 'ops', getToken: async () => 't' };
  it('loads a valid snapshot and sends a bearer token', async () => {
    let auth = '';
    const p = fabricProvider({ ...base, fetchImpl: (async (_u: unknown, init: RequestInit) => { auth = (init.headers as Record<string, string>).Authorization; return resp({ Tables: [{ Rows: [[JSON.stringify(buildSeed())]] }] }); }) as typeof fetch });
    expect((await p.load()).schemaVersion).toBe(p.schemaVersion);
    expect(auth).toBe('Bearer t');
  });
  it('rejects wrong schema and falls back to the seed (or throws when asked)', async () => {
    const bad = (async () => resp({ Tables: [{ Rows: [[{ schemaVersion: 99 }]] }] })) as unknown as typeof fetch;
    expect((await fabricProvider({ ...base, fetchImpl: bad }).load()).flights.length).toBeGreaterThan(0);
    await expect(fabricProvider({ ...base, fetchImpl: bad, fallbackToSeed: false }).load()).rejects.toThrow(/schemaVersion/);
    const down = (async () => resp({}, false, 503)) as unknown as typeof fetch;
    await expect(fabricProvider({ ...base, fetchImpl: down, fallbackToSeed: false }).load()).rejects.toThrow(/503/);
  });
});
