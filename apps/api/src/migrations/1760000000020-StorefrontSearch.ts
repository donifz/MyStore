import { MigrationInterface, QueryRunner } from 'typeorm';

export class StorefrontSearch1760000000020 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE variants ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
      CREATE INDEX IF NOT EXISTS variants_created_at_idx ON variants(created_at DESC, id);
      CREATE INDEX IF NOT EXISTS variants_sku_idx ON variants(sku);
      CREATE INDEX IF NOT EXISTS product_publications_approved_at_idx ON product_publications(approved_at DESC, variant_id);
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX IF EXISTS product_publications_approved_at_idx;
      DROP INDEX IF EXISTS variants_sku_idx;
      DROP INDEX IF EXISTS variants_created_at_idx;
      ALTER TABLE variants DROP COLUMN IF EXISTS created_at;
    `);
  }
}
