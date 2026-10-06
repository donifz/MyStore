import { MigrationInterface, QueryRunner } from 'typeorm';
export class Variants1760000000001 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE variants(id uuid PRIMARY KEY,shop_id uuid NOT NULL REFERENCES shops(id),name text NOT NULL CHECK(length(trim(name))>0),barcode text NOT NULL CHECK(length(barcode)>0),sale_price_minor bigint NOT NULL CHECK(sale_price_minor>=0 AND sale_price_minor<=9007199254740991),UNIQUE(shop_id,barcode),UNIQUE(shop_id,id))`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE variants');
  }
}
