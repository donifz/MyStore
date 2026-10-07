import { buildDataSource } from './database';
import { createApp } from './app';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RequestHandler } from 'express';
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const db = buildDataSource(process.env.DATABASE_URL);
  await db.initialize();
  const storefrontDir = resolve(__dirname, '../../storefront');
  if (
    process.env.NODE_ENV === 'production' &&
    !existsSync(resolve(storefrontDir, '.next/BUILD_ID'))
  )
    throw new Error('Next storefront build required in production');
  const storefront = existsSync(resolve(storefrontDir, '.next/BUILD_ID'))
    ? require('next')({ dev: false, dir: storefrontDir })
    : null;
  if (storefront) await storefront.prepare();
  const nextHandler = storefront?.getRequestHandler();
  const publicHandler: RequestHandler | undefined = nextHandler
    ? (req, res) => {
        void nextHandler(req, res);
      }
    : undefined;
  const app = await createApp(db, publicHandler);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
  const close = async () => {
    await app.close();
    if (storefront) await storefront.close();
    await db.destroy();
    process.exit(0);
  };
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
}
main().catch((e) => {
  console.error('API startup failed:', e.message);
  process.exitCode = 1;
});
