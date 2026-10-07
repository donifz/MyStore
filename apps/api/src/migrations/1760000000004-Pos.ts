import { MigrationInterface, QueryRunner } from 'typeorm';
export class Pos1760000000004 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
 CREATE TABLE cash_registers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),shop_id uuid NOT NULL UNIQUE REFERENCES shops(id),UNIQUE(shop_id,id));
 INSERT INTO cash_registers(shop_id) SELECT id FROM shops;
 CREATE TABLE cash_shifts(id uuid PRIMARY KEY,shop_id uuid NOT NULL,register_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES users(id),opening_cash_minor bigint NOT NULL CHECK(opening_cash_minor BETWEEN 0 AND 9007199254740991),actual_cash_minor bigint CHECK(actual_cash_minor BETWEEN 0 AND 9007199254740991),expected_cash_minor bigint,comment text,opened_at timestamptz NOT NULL DEFAULT now(),closed_at timestamptz,UNIQUE(shop_id,id),FOREIGN KEY(shop_id,register_id) REFERENCES cash_registers(shop_id,id));
 CREATE UNIQUE INDEX one_open_shift ON cash_shifts(register_id) WHERE closed_at IS NULL;
 CREATE TABLE pos_sales(shop_id uuid NOT NULL,document_id uuid NOT NULL,shift_id uuid NOT NULL,PRIMARY KEY(shop_id,document_id),FOREIGN KEY(shop_id,document_id) REFERENCES stock_documents(shop_id,id),FOREIGN KEY(shop_id,shift_id) REFERENCES cash_shifts(shop_id,id));
 CREATE TABLE payment_records(id uuid PRIMARY KEY,shop_id uuid NOT NULL,document_id uuid NOT NULL,shift_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES users(id),kind text NOT NULL CHECK(kind IN('sale','refund')),method text NOT NULL CHECK(method IN('cash','card')),amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 0 AND 9007199254740991),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(shop_id,document_id,kind),FOREIGN KEY(shop_id,document_id) REFERENCES stock_documents(shop_id,id),FOREIGN KEY(shop_id,shift_id) REFERENCES cash_shifts(shop_id,id));
 CREATE TRIGGER immutable_payments BEFORE UPDATE OR DELETE ON payment_records FOR EACH ROW EXECUTE FUNCTION deny_movement_changes();
 CREATE INDEX shift_payments ON payment_records(shop_id,shift_id);
 `);
  }
  async down(q: QueryRunner) {
    await q.query(
      'DROP TABLE payment_records,pos_sales,cash_shifts,cash_registers',
    );
  }
}
