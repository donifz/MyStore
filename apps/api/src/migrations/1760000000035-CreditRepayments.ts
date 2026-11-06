import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreditRepayments1760000000035 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE credit_repayments (
        shop_id uuid NOT NULL,
        id uuid NOT NULL,
        document_id uuid NOT NULL,
        shift_id uuid NOT NULL,
        actor_id uuid NOT NULL REFERENCES users(id),
        method text NOT NULL CHECK (method IN ('cash','card')),
        amount_minor bigint NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 9007199254740991),
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (shop_id,id),
        FOREIGN KEY (shop_id,document_id) REFERENCES credit_sales(shop_id,document_id),
        FOREIGN KEY (shop_id,shift_id) REFERENCES cash_shifts(shop_id,id)
      );
      CREATE TRIGGER immutable_credit_repayments BEFORE UPDATE OR DELETE ON credit_repayments FOR EACH ROW EXECUTE FUNCTION deny_movement_changes();
      CREATE INDEX credit_repayments_sale ON credit_repayments(shop_id,document_id,created_at DESC);
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE credit_repayments');
  }
}
