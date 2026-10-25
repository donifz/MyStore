import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeasonalStorefrontThemes1760000000028 implements MigrationInterface {
  name = 'SeasonalStorefrontThemes1760000000028';

  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE shops
        ADD COLUMN theme_content jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN theme_starts_at timestamptz,
        ADD COLUMN theme_ends_at timestamptz;
      UPDATE shops SET storefront_theme='base';
      ALTER TABLE shops ALTER COLUMN storefront_theme SET DEFAULT 'base';
    `);
  }

  async down(q: QueryRunner) {
    await q.query(`
      ALTER TABLE shops
        DROP COLUMN theme_ends_at,
        DROP COLUMN theme_starts_at,
        DROP COLUMN theme_content;
      UPDATE shops SET storefront_theme='classic';
      ALTER TABLE shops ALTER COLUMN storefront_theme SET DEFAULT 'classic';
    `);
  }
}
