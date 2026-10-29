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
    await page.goto(`/?${FROZEN}`);
    await page.getByRole('tab', { name: /AI agent/i }).click();
    await page.getByRole('button', { name: /start scenario/i }).click();
    await page.getByRole('button', { name: /run agent pipeline/i }).click();
    await expect(page.getByText('Proposed', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /approve and apply/i }).click();
    await expect(page.getByText('Applied', { exact: true }).first()).toBeVisible();
  });

  test('language switch keeps the app usable', async ({ page }) => {
    await page.goto(`/?${FROZEN}`);
    await page.getByRole('button', { name: /日本語/ }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  });
});

test.describe('accessibility', () => {
  for (const tab of [/Executive/i, /AI agent/i, /Value/i]) {
    test(`no critical axe violations on ${tab}`, async ({ page }) => {
      await page.goto(`/?${FROZEN}`);
      await page.getByRole('tab', { name: tab }).click();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(r.violations.filter((v) => v.impact === 'critical')).toEqual([]);
    });
  }
});
