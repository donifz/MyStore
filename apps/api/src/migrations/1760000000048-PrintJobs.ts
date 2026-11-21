import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrintJobs1760000000048 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS print_jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        created_by uuid REFERENCES users(id),
        kind text NOT NULL CHECK (kind IN ('label', 'receipt')),
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'printing', 'printed', 'failed')),
        payload jsonb NOT NULL,
        error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        printed_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS print_jobs_shop_status_idx
        ON print_jobs (shop_id, status, created_at DESC);
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS print_jobs;`);
  }
}
