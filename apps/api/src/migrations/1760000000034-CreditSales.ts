import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreditSales1760000000034 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE shop_customers
        ADD COLUMN credit_approved boolean NOT NULL DEFAULT false,
        ADD COLUMN credit_limit_minor bigint NOT NULL DEFAULT 0
          CHECK (credit_limit_minor BETWEEN 0 AND 9007199254740991);
      CREATE TABLE credit_sales (
        shop_id uuid NOT NULL,
        document_id uuid NOT NULL,
        customer_id uuid NOT NULL,
        paid_minor bigint NOT NULL CHECK (paid_minor BETWEEN 0 AND 9007199254740991),
        total_minor bigint NOT NULL CHECK (total_minor > 0 AND total_minor <= 9007199254740991),
        due_on date NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(shop_id,document_id),
        FOREIGN KEY(shop_id,document_id) REFERENCES pos_sales(shop_id,document_id),
        FOREIGN KEY(shop_id,customer_id) REFERENCES shop_customers(shop_id,id),
        CHECK (paid_minor < total_minor)
      );
      CREATE INDEX credit_sales_customer
        ON credit_sales(shop_id,customer_id,created_at DESC);
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE credit_sales');
    await q.query(
      'ALTER TABLE shop_customers DROP COLUMN credit_limit_minor,DROP COLUMN credit_approved',
    );
  }
}
