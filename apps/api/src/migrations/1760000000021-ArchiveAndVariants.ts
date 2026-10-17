import { MigrationInterface, QueryRunner } from 'typeorm';

export class ArchiveAndVariants1760000000021 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE variants
        ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES variants(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS variants_shop_archived_idx ON variants(shop_id, archived);
      CREATE INDEX IF NOT EXISTS variants_parent_id_idx ON variants(parent_id);
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX IF EXISTS variants_parent_id_idx;
      DROP INDEX IF EXISTS variants_shop_archived_idx;
      ALTER TABLE variants
        DROP COLUMN IF EXISTS parent_id,
        DROP COLUMN IF EXISTS archived;
    `);
  }
}
