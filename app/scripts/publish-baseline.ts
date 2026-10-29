import { writeFileSync } from 'node:fs';
import { buildSeed } from '../src/domain/seed';

// Emits the seed baseline as a one-line JSON payload that can be ingested into the Eventhouse table
// BaselineSnapshot (see scripts/fabric-setup.kql): `npx tsx scripts/publish-baseline.ts out.json`
const out = process.argv[2] ?? 'baseline.json';
writeFileSync(out, JSON.stringify(buildSeed()));
console.log(`wrote ${out}`);
