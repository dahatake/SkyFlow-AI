import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build, preview } from 'vite';
import { chromium } from '@playwright/test';
import { CUSTOMERS } from '../src/customers';

// Usage: npx tsx scripts/build-deck.ts [customerId]   -> out/decks/<customer>/<deck>.pdf (+ PNG per slide)
// The decks are authored for the reference customer (SATS / Changi). Names and dates are substituted from
// src/customers/<id>/customer.json at render time so a second customer needs no HTML edits.
const id = process.argv[2] ?? 'sats-changi';
const c = CUSTOMERS[id];
if (!c) { console.error(`Unknown customer ${id}. Known: ${Object.keys(CUSTOMERS).join(', ')}`); process.exit(1); }

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtMonthYear = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const personalise = (html: string) => id === 'sats-changi' ? html : html
  .replaceAll('SATS Project SPEAR', `${c.name} ${c.programme}`).replaceAll('Project SPEAR', c.programme).replaceAll('SATS', c.name)
  .replaceAll('Changi', c.airport.name.replace(/^.*\s/, '')).replaceAll('13 Nov', fmtDay(c.deck.mvpScopeDate)).replaceAll('Jan 2027', fmtMonthYear(c.deck.buildStartDate));

const root = join(import.meta.dirname, '..');
await build({ root, logLevel: 'warn' });
const server = await preview({ root, preview: { port: 4199, strictPort: true } });
const browser = await chromium.launch();
const out = join(root, 'out', 'decks', id);
mkdirSync(out, { recursive: true });

for (const lang of ['en', 'zh', 'ko', 'ja']) for (const deck of ['executive-briefing', 'cio-cto-briefing']) {
  const tag = lang === 'en' ? deck : `${deck}.${lang}`;
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.route(`**/presentation/${deck}.html*`, async (r) => { const res = await r.fetch(); await r.fulfill({ response: res, body: personalise(await res.text()) }); });
  await page.goto(`http://localhost:4199/presentation/${deck}.html?lang=${lang}`);
  const n = await page.locator('.slide').count();
  const shots: string[] = [];
  for (let i = 0; i < n; i++) {
    await page.goto(`http://localhost:4199/presentation/${deck}.html?lang=${lang}#${i + 1}`);
    await page.waitForTimeout(700);
    const f = join(out, `${tag}-${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: f });
    shots.push(f);
  }
  const pdf = await browser.newPage();
  await pdf.setContent(`<style>@page{size:1600px 900px;margin:0}body{margin:0}img{display:block;width:1600px;height:900px;page-break-after:always}</style>${shots.map((s) => `<img src="data:image/png;base64,${readFileSync(s).toString('base64')}">`).join('')}`);
  writeFileSync(join(out, `${tag}.pdf`), await pdf.pdf({ width: '1600px', height: '900px', printBackground: true }));
  console.log(`${tag}: ${n} slides -> ${join(out, `${tag}.pdf`)}`);
  await page.close(); await pdf.close();
}
await browser.close();
server.httpServer.close();
