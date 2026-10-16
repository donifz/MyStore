import { MigrationInterface, QueryRunner } from 'typeorm';

export class VariantAttributes1760000000015 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE variants
        ADD COLUMN size text NOT NULL DEFAULT '',
        ADD COLUMN color text NOT NULL DEFAULT '';
      ALTER TABLE variants
        ADD CONSTRAINT variants_size_length CHECK (length(size) <= 80),
        ADD CONSTRAINT variants_color_length CHECK (length(color) <= 80);
    `);
  }

  async down(q: QueryRunner) {
    await q.query(`
      ALTER TABLE variants
        DROP CONSTRAINT variants_size_length,
        DROP CONSTRAINT variants_color_length,
        DROP COLUMN size,
        DROP COLUMN color;
    `);
  }
}
