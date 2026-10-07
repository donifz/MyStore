import { MigrationInterface, QueryRunner } from 'typeorm';
export class Inventory1760000000002 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
 CREATE TABLE stock_balances(shop_id uuid NOT NULL,variant_id uuid NOT NULL,physical bigint NOT NULL DEFAULT 0 CHECK(physical>=0 AND physical<=1000000000),reserved bigint NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=physical),stock_value_minor bigint NOT NULL DEFAULT 0 CHECK(stock_value_minor>=0 AND stock_value_minor<=9007199254740991),PRIMARY KEY(shop_id,variant_id),FOREIGN KEY(shop_id,variant_id) REFERENCES variants(shop_id,id));
 CREATE TABLE stock_documents(id uuid PRIMARY KEY,shop_id uuid NOT NULL REFERENCES shops(id),actor_id uuid NOT NULL REFERENCES users(id),kind text NOT NULL CHECK(kind IN ('receiving','sale')),total_minor bigint NOT NULL CHECK(total_minor>=0 AND total_minor<=9007199254740991),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(shop_id,id));
 CREATE TABLE stock_movements(id uuid PRIMARY KEY,shop_id uuid NOT NULL,document_id uuid NOT NULL,variant_id uuid NOT NULL,quantity bigint NOT NULL CHECK(quantity<>0),value_minor bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(shop_id,variant_id) REFERENCES variants(shop_id,id),FOREIGN KEY(shop_id,document_id) REFERENCES stock_documents(shop_id,id));
 CREATE TABLE operation_results(shop_id uuid NOT NULL REFERENCES shops(id),key text NOT NULL,fingerprint text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(shop_id,key));
 CREATE FUNCTION deny_movement_changes() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Posted stock movements are immutable'; END $$;
 CREATE TRIGGER immutable_movements BEFORE UPDATE OR DELETE ON stock_movements FOR EACH ROW EXECUTE FUNCTION deny_movement_changes();
 `);
  }
  async down(q: QueryRunner) {
    await q.query(
      'DROP TABLE operation_results,stock_movements,stock_documents,stock_balances; DROP FUNCTION deny_movement_changes()',
    );
  }
}
