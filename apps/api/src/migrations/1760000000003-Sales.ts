import { MigrationInterface, QueryRunner } from 'typeorm';
export class Sales1760000000003 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE sale_lines(id uuid PRIMARY KEY,shop_id uuid NOT NULL,document_id uuid NOT NULL,variant_id uuid NOT NULL,name text NOT NULL,barcode text NOT NULL,quantity bigint NOT NULL CHECK(quantity>0),unit_price_minor bigint NOT NULL CHECK(unit_price_minor>=0),cost_minor bigint NOT NULL CHECK(cost_minor>=0),FOREIGN KEY(shop_id,document_id)REFERENCES stock_documents(shop_id,id),FOREIGN KEY(shop_id,variant_id)REFERENCES variants(shop_id,id))`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE sale_lines');
  }
}
