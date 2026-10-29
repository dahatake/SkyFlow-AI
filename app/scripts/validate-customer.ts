import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateCustomer } from '../src/customers/schema';

const root = join(import.meta.dirname, '..', 'src', 'customers');
const only = process.argv[2];
let failed = false;
for (const d of readdirSync(root, { withFileTypes: true }).filter((x) => x.isDirectory() && (!only || x.name === only))) {
  const f = join(root, d.name, 'customer.json');
  if (!existsSync(f)) { console.error(`✖ ${d.name}: customer.json missing`); failed = true; continue; }
  const errs = validateCustomer(JSON.parse(readFileSync(f, 'utf8')));
  if (errs.length) { failed = true; console.error(`✖ ${d.name}\n  - ${errs.join('\n  - ')}`); } else console.log(`✔ ${d.name}`);
}
process.exit(failed ? 1 : 0);
