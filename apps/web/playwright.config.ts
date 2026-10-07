import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.E2E_BROWSER_PATH,
      args: process.env.E2E_BROWSER_PATH
        ? ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote']
        : [],
    },
  },
  globalSetup: './e2e/setup.ts',
  reporter: 'list',
});
