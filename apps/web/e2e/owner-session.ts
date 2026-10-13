import { expect, type Browser, type BrowserContext } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
// Cache only the dedicated fixture account, and validate it after globalSetup resets the DB.
const origin = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001';
export const ownerStatePath = join(
  tmpdir(),
  `mystore-ui-owner-${createHash('sha256').update(origin).digest('hex').slice(0, 12)}.json`,
);
export async function ownerCookies(
  browser: Browser,
): Promise<Awaited<ReturnType<BrowserContext['cookies']>>> {
  const saved = existsSync(ownerStatePath)
    ? JSON.parse(readFileSync(ownerStatePath, 'utf8'))
    : undefined;
  const context = await browser.newContext(
    saved ? { storageState: saved } : {},
  );
  try {
    const me = await context.request.get(origin + '/api/auth/me');
    if (!me.ok() || (await me.json()).email !== 'owner@example.test') {
      await context.clearCookies();
      const page = await context.newPage();
      await page.goto(origin + '/seller/login');
      await page.getByLabel('Email').fill('owner@example.test');
      await page.getByLabel('Пароль').fill('browser-test-password');
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Товары', exact: true }),
      ).toBeVisible();
      writeFileSync(
        ownerStatePath,
        JSON.stringify(await context.storageState()),
        { mode: 0o600 },
      );
    }
    return await context.cookies();
  } finally {
    await context.close();
  }
}
