import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreditRepayments1760000000035 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $migration$
      DECLARE old_constraint text;
      BEGIN
        SELECT con.conname INTO old_constraint
        FROM pg_constraint con
        WHERE con.conrelid='credit_sales'::regclass
          AND con.contype='c'
          AND pg_get_constraintdef(con.oid) LIKE '%paid_minor < total_minor%';
        IF old_constraint IS NULL THEN
          RAISE EXCEPTION 'Expected strict credit_sales paid<total check not found';
        END IF;
        EXECUTE format('ALTER TABLE credit_sales DROP CONSTRAINT %I', old_constraint);
      END $migration$;
      ALTER TABLE credit_sales ADD CONSTRAINT credit_sales_paid_lte_total
        CHECK (paid_minor <= total_minor);
      CREATE TABLE credit_repayments (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL,
        sale_id uuid NOT NULL,
        shift_id uuid NOT NULL,
        actor_id uuid NOT NULL REFERENCES users(id),
        method text NOT NULL CHECK(method IN ('cash','card')),
        amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 9007199254740991),
        created_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY (shop_id,sale_id)
          REFERENCES credit_sales(shop_id,document_id),
        FOREIGN KEY (shop_id,shift_id)
          REFERENCES cash_shifts(shop_id,id)
      );
      CREATE INDEX credit_repayments_sale_idx
        ON credit_repayments(shop_id,sale_id,created_at,id);
      CREATE INDEX credit_repayments_shift_idx
        ON credit_repayments(shop_id,shift_id,created_at);
      CREATE TRIGGER immutable_credit_repayments
        BEFORE UPDATE OR DELETE ON credit_repayments
        FOR EACH ROW EXECUTE FUNCTION deny_movement_changes();
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE credit_repayments');
    await q.query(
      'ALTER TABLE credit_sales DROP CONSTRAINT credit_sales_paid_lte_total',
    );
    await q.query(
      'ALTER TABLE credit_sales ADD CONSTRAINT credit_sales_unpaid CHECK(paid_minor < total_minor)',
    );
  }
}
