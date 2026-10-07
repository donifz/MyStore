import { MigrationInterface, QueryRunner } from 'typeorm';
export class Storefront1760000000006 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE shops ADD COLUMN slug text;
      UPDATE shops SET slug='shop-' || replace(id::text,'-','');
      ALTER TABLE shops ALTER COLUMN slug SET NOT NULL;
      ALTER TABLE shops ALTER COLUMN slug SET DEFAULT 'shop-' || replace(gen_random_uuid()::text,'-','');
      ALTER TABLE shops ADD CONSTRAINT shops_slug_unique UNIQUE(slug);
      ALTER TABLE shops ADD COLUMN description text NOT NULL DEFAULT '', ADD COLUMN city text NOT NULL DEFAULT '', ADD COLUMN address text NOT NULL DEFAULT '', ADD COLUMN phone text NOT NULL DEFAULT '', ADD COLUMN hours text NOT NULL DEFAULT '', ADD COLUMN published boolean NOT NULL DEFAULT false;
      ALTER TABLE variants ADD COLUMN description text NOT NULL DEFAULT '', ADD COLUMN category text NOT NULL DEFAULT '', ADD COLUMN published boolean NOT NULL DEFAULT true;
      CREATE INDEX variants_public_category ON variants(category,shop_id) WHERE published;
    `);
  }
  async down(q: QueryRunner) {
    await q.query(
      'DROP INDEX variants_public_category; ALTER TABLE variants DROP COLUMN description,DROP COLUMN category,DROP COLUMN published; ALTER TABLE shops DROP COLUMN slug,DROP COLUMN description,DROP COLUMN city,DROP COLUMN address,DROP COLUMN phone,DROP COLUMN hours,DROP COLUMN published',
    );
  }
}
