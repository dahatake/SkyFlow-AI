import { buildSeed, SCHEMA_VERSION, SEED_VERSION } from '../domain/seed';
import type { Baseline } from '../domain/types';

/** Presentation code depends only on this interface; a Fabric adapter can replace the seed provider later. */
export interface DataProvider {
  readonly id: string;
  readonly schemaVersion: number;
  readonly seedVersion: string;
  load(): Promise<Baseline>;
}

export const seedProvider: DataProvider = {
  id: 'seed',
  schemaVersion: SCHEMA_VERSION,
  seedVersion: SEED_VERSION,
  load: async () => buildSeed(),
};

let current: DataProvider = seedProvider;
export const getProvider = () => current;
export const setProvider = (p: DataProvider) => { current = p; };
