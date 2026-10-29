import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FROZEN = 'clock=2027-01-11T08:00:00%2B08:00';

test.describe('thunderstorm demo path', () => {
  test('guided demo reaches the value breakdown with visible assumptions', async ({ page }) => {
    await page.goto(`/?${FROZEN}&demo=1`);
    await expect(page.getByRole('complementary', { name: /guided demo/i })).toBeVisible();
    for (let i = 0; i < 5; i++) await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page.getByText(/Simulated results combined with assumptions/i).first()).toBeVisible();
    await expect(page.getByText(/Estimated saving/i).first()).toBeVisible();
  });

  test('agent proposal requires approval before decisions change', async ({ page }) => {
    const externalRequests: string[] = [];
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(test.info().project.use.baseURL!).origin) {
        externalRequests.push(url.href);
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(`/?${FROZEN}`);
    await page.getByRole('tab', { name: /^Tasks/ }).click();
    await page.getByRole('tab', { name: /Task Resolver/i }).click();
    await expect(page.getByText('Local demo: deterministic rules only. No LLM, cloud services or external notifications.')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Mode', exact: true })).toHaveCount(0);
    await page.route('**/api/**', (route) => { throw new Error(`Unexpected API request: ${route.request().url()}`); });
    await page.getByRole('button', { name: /start scenario/i }).click();
    await page.getByRole('button', { name: /run agent pipeline/i }).click();
    await expect(page.getByText('Proposed', { exact: true }).first()).toBeVisible();
    await page.getByRole('tab', { name: /^Decisions/i }).click();
    await expect(page.locator('.tasks > .task.done')).toHaveCount(0);
    await page.getByRole('tab', { name: /^Tasks/ }).click();
    await page.getByRole('tab', { name: /Task Resolver/i }).click();
    await page.getByRole('button', { name: /run agent pipeline/i }).click();
    await page.getByRole('button', { name: /approve and apply/i }).click();
    await expect(page.getByText('Applied', { exact: true }).first()).toBeVisible();
    await page.getByRole('tab', { name: /^Decisions/i }).click();
    await expect(page.locator('.tasks > .task.done')).toHaveCount(2);
    await page.reload();
    const storedDecisions = await page.evaluate(() => new Promise<number>((resolve, reject) => {
      const open = indexedDB.open('aoct-prototype', 3);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const request = db.transaction('scenarios').objectStore('scenarios').get('demo-weather');
        request.onerror = () => { db.close(); reject(request.error); };
        request.onsuccess = () => {
          const scenario: { decisions?: Record<string, unknown> } | undefined = request.result;
          db.close();
          resolve(Object.keys(scenario?.decisions ?? {}).length);
        };
      };
    }));
    expect(storedDecisions).toBe(2);
    expect(externalRequests).toEqual([]);
  });

  test('language switch keeps the app usable', async ({ page }) => {
    await page.goto(`/?${FROZEN}`);
    await page.getByRole('button', { name: /日本語/ }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  });

  test('only managers can approve, and rejecting a proposal leaves decisions unchanged', async ({ page }) => {
    await page.goto(`/?${FROZEN}`);
    await page.getByRole('tab', { name: /^Tasks/ }).click();
    await page.getByRole('tab', { name: /Task Resolver/i }).click();
    await page.getByRole('button', { name: /start scenario/i }).click();
    for (const role of ['Ramp Lead', 'Action Owner', 'Observer']) {
      await page.getByRole('group', { name: 'Choose a role lens' }).getByRole('button', { name: new RegExp(role) }).click();
      await page.getByRole('tab', { name: /^Tasks/ }).click();
    await page.getByRole('tab', { name: /Task Resolver/i }).click();
      await page.getByRole('button', { name: /run agent pipeline/i }).click();
      await expect(page.getByRole('button', { name: /approve and apply/i })).toBeDisabled();
    }
    await page.getByRole('group', { name: 'Choose a role lens' }).getByRole('button', { name: /^Tower Lead/ }).click();
    await page.getByRole('tab', { name: /^Tasks/ }).click();
    await page.getByRole('tab', { name: /Task Resolver/i }).click();
    await page.getByRole('button', { name: /run agent pipeline/i }).click();
    await page.getByRole('button', { name: /^Reject$/ }).click();
    await expect(page.getByText('Rejected', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /^Decisions/i }).click();
    await expect(page.locator('.tasks > .task.done')).toHaveCount(0);
  });

  test('a storage failure is visible and never reports approval success', async ({ page }) => {
    await page.goto(`/?${FROZEN}`);
    await page.getByRole('tab', { name: /^Tasks/ }).click();
    await page.getByRole('tab', { name: /Task Resolver/i }).click();
    await page.getByRole('button', { name: /start scenario/i }).click();
    await page.getByRole('button', { name: /run agent pipeline/i }).click();
    await page.evaluate(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
        if (this.name === 'scenarios') throw new DOMException('Storage unavailable', 'QuotaExceededError');
        return put.call(this, value, key);
      };
    });
    await page.getByRole('button', { name: /approve and apply/i }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Approval failed:' })).toBeVisible();
    await expect(page.getByText('Proposed', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Applied', { exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: /^Decisions/i }).click();
    await expect(page.locator('.tasks > .task.done')).toHaveCount(0);
  });

  test('every workspace loads without external services', async ({ page, baseURL }) => {
    const externalRequests: string[] = [];
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(baseURL!).origin || url.pathname.startsWith('/api/')) {
        externalRequests.push(url.href);
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(`/?${FROZEN}`);
    const tabs = page.getByRole('navigation', { name: 'Views' }).getByRole('tab');
    for (let i = 0; i < await tabs.count(); i++) {
      await tabs.nth(i).click();
      await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true');
    }
    expect(externalRequests).toEqual([]);
  });

  test('the current architecture is presented horizontally with local-only components', async ({ page }) => {
    await page.goto('/presentation/cio-cto-briefing.html#9');
    const slide = page.locator('section[aria-label="Prototype component architecture"]');
    await expect(slide).toHaveClass(/active/);
    await expect(slide.getByText('No cloud or LLM.', { exact: true })).toBeVisible();
    const cards = slide.locator('.cards > .card');
    await expect(cards).toHaveCount(5);
    const boxes = await cards.evaluateAll((elements) => elements.map((el) => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    }));
    for (let i = 1; i < boxes.length; i++) {
      expect(Math.abs(boxes[i].y - boxes[0].y)).toBeLessThan(1);
      expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width);
    }
  });
});

test.describe('analytics', () => {
  test('renders linked charts and updates findings on brush', async ({ page }) => {
    await page.goto(`/?${FROZEN}`);
    await page.getByRole('tab', { name: /Analytics/i }).click();
    await expect(page.getByRole('img', { name: /Histogram of forecast slip/i })).toBeVisible();
    await expect(page.getByRole('img', { name: /Heatmap of exception counts/i })).toBeVisible();
    const findings = page.getByTestId('analytics-findings');
    const before = (await findings.textContent())!;
    const overlay = page.locator('svg .overlay').first();
    await overlay.scrollIntoViewIfNeeded();
    const box = (await overlay.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.4, box.y + 5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2, box.y + 5, { steps: 5 });
    await page.mouse.up();
    await expect(findings).not.toHaveText(before);
    await page.getByRole('button', { name: /Clear selection/i }).click();
    await expect(findings).toHaveText(before);
  });
});

test.describe('accessibility', () => {
  for (const tab of [/^Business Value/, /^Tasks/, /^Overview/]) {
    test(`no critical axe violations on ${tab}`, async ({ page }) => {
      await page.goto(`/?${FROZEN}`);
      await page.getByRole('tab', { name: tab }).click();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(r.violations.filter((v) => v.impact === 'critical')).toEqual([]);
    });
  }
});
