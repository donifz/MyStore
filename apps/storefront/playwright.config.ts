import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
const macChrome =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:43100',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath:
        process.env.E2E_BROWSER_PATH ||
        (!process.env.CI && existsSync(macChrome) ? macChrome : undefined),
    },
  },
  webServer: {
    command: 'node e2e/fixture-server.cjs',
    url: 'http://127.0.0.1:43100/health',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
