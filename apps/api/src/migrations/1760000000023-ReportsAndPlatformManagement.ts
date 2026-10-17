import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportsAndPlatformManagement1760000000023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE online_orders
        ADD COLUMN IF NOT EXISTS issued_at timestamptz NULL;
    `);

    await queryRunner.query(`
      UPDATE online_orders
      SET issued_at = updated_at
      WHERE status = 'issued' AND issued_at IS NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS online_orders_shop_issued_at_idx
      ON online_orders(shop_id, issued_at);
    `);

    await queryRunner.query(`
      ALTER TABLE shops
        ADD COLUMN IF NOT EXISTS marketplace_blocked boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS marketplace_block_reason text NULL,
        ADD COLUMN IF NOT EXISTS subscription_until timestamptz NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS shops_marketplace_blocked_idx
      ON shops(marketplace_blocked);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS shops_marketplace_blocked_idx;
      ALTER TABLE shops
        DROP COLUMN IF EXISTS marketplace_blocked,
        DROP COLUMN IF EXISTS marketplace_block_reason,
        DROP COLUMN IF EXISTS subscription_until;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS online_orders_shop_issued_at_idx;
      ALTER TABLE online_orders
        DROP COLUMN IF EXISTS issued_at;
    `);
  }
}
