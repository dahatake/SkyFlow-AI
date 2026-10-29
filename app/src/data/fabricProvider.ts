import { SCHEMA_VERSION } from '../domain/seed';
import type { Baseline } from '../domain/types';
import type { DataProvider } from './provider';
import { seedProvider } from './provider';

export interface FabricOptions {
  /** Eventhouse / KQL database query URI, e.g. https://<cluster>.kusto.fabric.microsoft.com */
  queryUri: string;
  database: string;
  /** Returns an Entra access token for the Kusto resource (scope https://kusto.kusto.windows.net/.default). */
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
  /** Fall back to the bundled seed when Fabric is unreachable or returns something unusable. Default true. */
  fallbackToSeed?: boolean;
}

export const BASELINE_KQL = 'BaselineSnapshot | top 1 by IngestedAt desc | project Payload';

function assertBaseline(x: unknown): Baseline {
  const b = x as Partial<Baseline> | null;
  if (!b || typeof b !== 'object') throw new Error('Fabric payload is not an object');
  if (b.schemaVersion !== SCHEMA_VERSION) throw new Error(`Fabric schemaVersion ${String(b.schemaVersion)} != ${SCHEMA_VERSION}`);
  for (const k of ['flights', 'turnarounds', 'tasks', 'assets', 'exceptions', 'stands'] as const) {
    if (!Array.isArray(b[k])) throw new Error(`Fabric payload is missing ${k}`);
  }
  return b as Baseline;
}

/** Reads the latest Baseline snapshot from a Fabric Eventhouse (KQL). Same interface as the seed provider. */
export function fabricProvider(o: FabricOptions): DataProvider {
  const f = o.fetchImpl ?? fetch;
  return {
    id: 'fabric',
    schemaVersion: SCHEMA_VERSION,
    seedVersion: 'fabric',
    async load() {
      try {
        const r = await f(`${o.queryUri.replace(/\/$/, '')}/v1/rest/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await o.getToken()}` },
          body: JSON.stringify({ db: o.database, csl: BASELINE_KQL }),
        });
        if (!r.ok) throw new Error(`Fabric query failed: ${r.status}`);
        const j = (await r.json()) as { Tables?: { Rows?: unknown[][] }[] };
        const cell = j.Tables?.[0]?.Rows?.[0]?.[0];
        if (cell === undefined) throw new Error('Fabric returned no snapshot');
        return assertBaseline(typeof cell === 'string' ? JSON.parse(cell) : cell);
      } catch (e) {
        if (o.fallbackToSeed === false) throw e;
        console.warn('fabric-provider-fallback', (e as Error).message);
        return seedProvider.load();
      }
    },
  };
}
