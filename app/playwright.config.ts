import { defineConfig, devices } from '@playwright/test';

const url = process.env.E2E_BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: url, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Against a deployed site set E2E_BASE_URL and no server is started.
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'npm run dev -- --port 4173 --strictPort', url, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
