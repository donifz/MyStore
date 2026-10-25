import { MigrationInterface, QueryRunner } from 'typeorm';

export class StorefrontThemes1760000000026 implements MigrationInterface {
  name = 'StorefrontThemes1760000000026';

  async up(q: QueryRunner) {
    await q.query(
      "ALTER TABLE shops ADD COLUMN storefront_theme varchar(32) NOT NULL DEFAULT 'classic'",
    );
  }

  async down(q: QueryRunner) {
    await q.query('ALTER TABLE shops DROP COLUMN storefront_theme');
  }
}
