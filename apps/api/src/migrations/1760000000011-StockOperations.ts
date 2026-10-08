import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockOperations1760000000011 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE stock_documents DROP CONSTRAINT stock_documents_kind_check;
      ALTER TABLE stock_documents ADD CONSTRAINT stock_documents_kind_check
        CHECK(kind IN ('receiving','sale','return','inventory_count','writeoff','defect_disposal'));
      CREATE TABLE inventory_adjustments (
        document_id uuid NOT NULL, shop_id uuid NOT NULL, variant_id uuid NOT NULL,
        expected_quantity bigint NOT NULL, counted_quantity bigint NOT NULL,
        delta_quantity bigint NOT NULL, delta_value_minor bigint NOT NULL,
        reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),
        PRIMARY KEY(shop_id,document_id,variant_id),
        FOREIGN KEY(shop_id,document_id) REFERENCES stock_documents(shop_id,id),
        FOREIGN KEY(shop_id,variant_id) REFERENCES variants(shop_id,id)
      );
      CREATE TABLE defective_balances (
        shop_id uuid NOT NULL,variant_id uuid NOT NULL,
        quantity bigint NOT NULL DEFAULT 0 CHECK(quantity BETWEEN 0 AND 1000000000),
        value_minor bigint NOT NULL DEFAULT 0 CHECK(value_minor BETWEEN 0 AND 9007199254740991),
        PRIMARY KEY(shop_id,variant_id),
        FOREIGN KEY(shop_id,variant_id) REFERENCES variants(shop_id,id)
      );
      CREATE TABLE defective_movements (
        id uuid PRIMARY KEY,shop_id uuid NOT NULL,variant_id uuid NOT NULL,
        document_id uuid NOT NULL,quantity bigint NOT NULL CHECK(quantity<>0),
        value_minor bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY(shop_id,variant_id) REFERENCES variants(shop_id,id),
        FOREIGN KEY(shop_id,document_id) REFERENCES stock_documents(shop_id,id)
      );
      CREATE TRIGGER immutable_defective_movements BEFORE UPDATE OR DELETE ON defective_movements
        FOR EACH ROW EXECUTE FUNCTION deny_movement_changes();
      INSERT INTO defective_balances(shop_id,variant_id,quantity,value_minor)
        SELECT r.shop_id,s.variant_id,sum(r.quantity),sum(r.cost_minor)
        FROM return_lines r JOIN sale_lines s ON s.shop_id=r.shop_id AND s.id=r.sale_line_id
        WHERE r.condition='defective' GROUP BY r.shop_id,s.variant_id;
    `);
  }
  async down(q: QueryRunner) {
    await q.query(`
      DROP TABLE defective_movements,defective_balances,inventory_adjustments;
      ALTER TABLE stock_documents DROP CONSTRAINT stock_documents_kind_check;
      ALTER TABLE stock_documents ADD CONSTRAINT stock_documents_kind_check
        CHECK(kind IN ('receiving','sale','return'));
    `);
  }
}
