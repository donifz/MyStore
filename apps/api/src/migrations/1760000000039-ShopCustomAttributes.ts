import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShopCustomAttributes1760000000039 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS shop_custom_attributes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        name varchar(80) NOT NULL,
        key varchar(50) NOT NULL,
        type varchar(20) NOT NULL CHECK (type IN ('string', 'number', 'select')),
        options jsonb NOT NULL DEFAULT '[]'::jsonb,
        filterable boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (shop_id, key)
      );

      CREATE INDEX IF NOT EXISTS shop_custom_attributes_shop_idx
        ON shop_custom_attributes (shop_id, created_at ASC);

      ALTER TABLE variants
        ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

      ALTER TABLE product_publications
        ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

      ALTER TABLE product_publication_revisions
        ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

      CREATE INDEX IF NOT EXISTS variants_attributes_gin
        ON variants USING gin (attributes);
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX IF EXISTS variants_attributes_gin;
      ALTER TABLE product_publication_revisions DROP COLUMN IF EXISTS attributes;
      ALTER TABLE product_publications DROP COLUMN IF EXISTS attributes;
      ALTER TABLE variants DROP COLUMN IF EXISTS attributes;
      DROP TABLE IF EXISTS shop_custom_attributes;
    `);
  }
}
