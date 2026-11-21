import { MigrationInterface, QueryRunner } from 'typeorm';

export class VariantLabelPrintCount1760000000046 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE variants
      ADD COLUMN IF NOT EXISTS label_print_count integer NOT NULL DEFAULT 0;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE variants
      DROP COLUMN IF EXISTS label_print_count;
    `);
  }
}
