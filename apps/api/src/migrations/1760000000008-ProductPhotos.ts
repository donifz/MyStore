import { MigrationInterface, QueryRunner } from 'typeorm';
export class ProductPhotos1760000000008 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
  CREATE SEQUENCE variant_sku_seq;
  CREATE FUNCTION format_variant_sku(value bigint) RETURNS text LANGUAGE SQL IMMUTABLE AS $$ SELECT 'MS-' || lpad(value::text,greatest(8,length(value::text)),'0') $$;
  ALTER TABLE variants ADD COLUMN sku text NOT NULL DEFAULT format_variant_sku(nextval('variant_sku_seq'));
  ALTER TABLE variants ADD CONSTRAINT variants_shop_sku_unique UNIQUE(shop_id,sku);
  ALTER TABLE variants ADD COLUMN photo_data bytea CHECK(photo_data IS NULL OR octet_length(photo_data)<=524288);
 `);
  }
  async down(q: QueryRunner) {
    await q.query(
      'ALTER TABLE variants DROP COLUMN photo_data,DROP COLUMN sku; DROP FUNCTION format_variant_sku(bigint); DROP SEQUENCE variant_sku_seq',
    );
  }
}
