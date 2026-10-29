import { chromium } from '@playwright/test';
import { join } from 'node:path';

// Needs the dev server: `npm run dev -- --port 4173`. Writes docs/img/*.png for the README and the playbook.
const base = process.env.E2E_BASE_URL ?? 'http://localhost:4173';
const out = join(import.meta.dirname, '..', '..', 'docs', 'img');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(`${base}/?clock=2027-01-11T08:00:00%2B08:00`);
const shot = async (name: string) => { await page.waitForTimeout(500); await page.screenshot({ path: join(out, `${name}.png`) }); console.log(name); };

await page.getByRole('tab', { name: /Overview/ }).click(); await shot('01-overview');
await page.getByRole('button', { name: /Weather delay/ }).click();
await page.getByRole('tab', { name: /Executive/ }).click(); await shot('02-executive-problem');
await page.getByRole('tab', { name: /AI agent/ }).click();
await page.getByRole('button', { name: /run agent pipeline/i }).click(); await shot('03-agent-proposal');
await page.getByRole('button', { name: /approve and apply/i }).click();
await page.getByRole('tab', { name: /Task list/ }).click(); await shot('04-tasks');
await page.getByRole('tab', { name: /^Value/ }).click(); await shot('05-value');
await browser.close();
