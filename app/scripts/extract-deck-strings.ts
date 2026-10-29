import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

// Usage: npx tsx scripts/extract-deck-strings.ts [--check]
// Lists every English string the decks need translated. Writes out/deck-strings.json, or with --check fails
// when presentation/i18n/{zh,ko,ja}.ts miss a key.
const root = join(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const server = await createServer({ root, logLevel: 'error', server: { port: 4198, strictPort: true } });
await server.listen();
const browser = await chromium.launch();
const keys = new Set<string>();
const DECKS = ['executive-briefing', 'cio-cto-briefing'];
for (const deck of DECKS) {
  const page = await browser.newPage();
  await page.goto(`http://localhost:4198/presentation/${deck}.html?lang=en`);
  const found: string[] = await page.evaluate(async () => {
    const { walk, norm } = await import('/presentation/i18n.ts');
    const out: string[] = [];
    walk(document.body, (_e, k) => out.push(k), (_e, _a, k) => out.push(k));
    out.push(norm(document.title), norm(document.querySelector('meta[name="description"]')?.getAttribute('content') ?? ''));
    return out;
  });
  found.filter(Boolean).forEach((k) => keys.add(k));
  await page.close();
}
// Strings created in presentation/scene.ts
['Control tower', 'Microsoft Fabric · OneLake', 'GroundStar', 'G-Ops · Mosaic · DSM', 'CAG turnaround events', 'iFleet · GSE', 'BRS baggage', 'Weather · airline SLAs',
  'Sources', 'Ingest · Eventstreams · Data Factory', 'Microsoft Fabric · OneLake · Eventhouse · Activator', 'Experiences · Power BI · Teams · Copilot', 'Users · Executives · SIOC · BU Ops · Ramp',
  'Gate conflict {n}', 'Owner assigned · Teams ✓', 'Baseline · untouched', 'Scenario · simulated'].forEach((k) => keys.add(k));
await browser.close();
await server.close();

const list = [...keys].sort();
if (check) {
  let missing = 0;
  for (const l of ['zh', 'ko', 'ja']) {
    const d = (await import(`../presentation/i18n/${l}.ts`)).default as Record<string, string>;
    const m = list.filter((k) => !d[k]);
    const extra = Object.keys(d).filter((k) => !keys.has(k));
    m.forEach((k) => console.error(`[${l}] missing: ${k}`));
    extra.forEach((k) => console.error(`[${l}] unused: ${k}`));
    missing += m.length + extra.length;
  }
  console.log(missing ? `${missing} problem(s)` : `OK: ${list.length} strings x 3 languages`);
  process.exit(missing ? 1 : 0);
}
writeFileSync(join(root, 'out', 'deck-strings.json'), JSON.stringify(list, null, 1));
console.log(`${list.length} strings -> out/deck-strings.json`);
