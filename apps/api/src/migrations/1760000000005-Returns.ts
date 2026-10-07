import { MigrationInterface, QueryRunner } from 'typeorm';
export class Returns1760000000005 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
 ALTER TABLE stock_documents DROP CONSTRAINT stock_documents_kind_check;
 ALTER TABLE stock_documents ADD CONSTRAINT stock_documents_kind_check CHECK(kind IN('receiving','sale','return'));
 ALTER TABLE sale_lines ADD CONSTRAINT sale_lines_shop_id_id_key UNIQUE(shop_id,id);
 CREATE TABLE return_documents(shop_id uuid NOT NULL,document_id uuid NOT NULL,sale_id uuid NOT NULL,reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),refund_money boolean NOT NULL,PRIMARY KEY(shop_id,document_id),FOREIGN KEY(shop_id,document_id) REFERENCES stock_documents(shop_id,id),FOREIGN KEY(shop_id,sale_id) REFERENCES stock_documents(shop_id,id));
 CREATE TABLE return_lines(id uuid PRIMARY KEY,shop_id uuid NOT NULL,document_id uuid NOT NULL,sale_line_id uuid NOT NULL,quantity bigint NOT NULL CHECK(quantity BETWEEN 1 AND 1000000000),condition text NOT NULL CHECK(condition IN('resellable','defective')),unit_price_minor bigint NOT NULL CHECK(unit_price_minor>=0),cost_minor bigint NOT NULL CHECK(cost_minor>=0),UNIQUE(shop_id,document_id,sale_line_id),FOREIGN KEY(shop_id,document_id) REFERENCES return_documents(shop_id,document_id),FOREIGN KEY(shop_id,sale_line_id) REFERENCES sale_lines(shop_id,id));
 CREATE INDEX returned_sale_lines ON return_lines(shop_id,sale_line_id);
 CREATE TRIGGER immutable_return_lines BEFORE UPDATE OR DELETE ON return_lines FOR EACH ROW EXECUTE FUNCTION deny_movement_changes();
 CREATE TRIGGER immutable_return_documents BEFORE UPDATE OR DELETE ON return_documents FOR EACH ROW EXECUTE FUNCTION deny_movement_changes();
 `);
  }
  async down(q: QueryRunner) {
    await q.query(
      'DROP TABLE return_lines,return_documents;ALTER TABLE sale_lines DROP CONSTRAINT sale_lines_shop_id_id_key',
    );
    /* Existing return documents require explicit archival before rollback. */ await q.query(
      "ALTER TABLE stock_documents DROP CONSTRAINT stock_documents_kind_check;ALTER TABLE stock_documents ADD CONSTRAINT stock_documents_kind_check CHECK(kind IN('receiving','sale'))",
    );
  }
}
