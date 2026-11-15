import { MigrationInterface, QueryRunner } from 'typeorm';

export class PosTerminalQueue1760000000045 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE pos_terminal_settings (
        shop_id uuid PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
        payment_qr_data text,
        payment_qr_label text NOT NULL DEFAULT 'Оплата по QR',
        show_qr_on_checkout boolean NOT NULL DEFAULT true,
        print_qr_on_receipt boolean NOT NULL DEFAULT false,
        paper_width integer NOT NULL DEFAULT 58 CHECK (paper_width IN (58, 80)),
        auto_print boolean NOT NULL DEFAULT true,
        receipt_header text NOT NULL DEFAULT '',
        receipt_footer text NOT NULL DEFAULT 'Спасибо за покупку!',
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE pos_terminal_jobs (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        sale_id uuid,
        kind text NOT NULL DEFAULT 'receipt',
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'printed', 'failed')),
        payload jsonb NOT NULL,
        error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX pos_terminal_jobs_shop_sale_kind_uidx
        ON pos_terminal_jobs(shop_id, sale_id, kind)
        WHERE sale_id IS NOT NULL;

      CREATE INDEX pos_terminal_jobs_shop_status_created_idx
        ON pos_terminal_jobs(shop_id, status, created_at DESC);
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX IF EXISTS pos_terminal_jobs_shop_status_created_idx;
      DROP INDEX IF EXISTS pos_terminal_jobs_shop_sale_kind_uidx;
      DROP TABLE IF EXISTS pos_terminal_jobs;
      DROP TABLE IF EXISTS pos_terminal_settings;
    `);
  }
}
