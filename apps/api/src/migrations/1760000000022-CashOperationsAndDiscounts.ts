import { MigrationInterface, QueryRunner } from 'typeorm';

export class CashOperationsAndDiscounts1760000000022 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cash_transactions (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL,
        shift_id uuid NOT NULL,
        actor_id uuid NOT NULL REFERENCES users(id),
        type text NOT NULL CHECK(type IN ('in', 'out')),
        amount_minor bigint NOT NULL CHECK(amount_minor > 0),
        reason text NOT NULL CHECK(char_length(trim(reason)) > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY (shop_id, shift_id) REFERENCES cash_shifts(shop_id, id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS cash_transactions_shift_idx
      ON cash_transactions(shop_id, shift_id, created_at);
    `);

    await queryRunner.query(`
      ALTER TABLE sale_lines
        ADD COLUMN IF NOT EXISTS discount_minor bigint NOT NULL DEFAULT 0 CHECK(discount_minor >= 0),
        ADD COLUMN IF NOT EXISTS discount_reason text,
        ADD COLUMN IF NOT EXISTS discount_actor_id uuid REFERENCES users(id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sale_lines
        DROP COLUMN IF EXISTS discount_minor,
        DROP COLUMN IF EXISTS discount_reason,
        DROP COLUMN IF EXISTS discount_actor_id;
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS cash_transactions CASCADE;`);
  }
}
