import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShopSlugHistory1760000000025 implements MigrationInterface {
  name = 'ShopSlugHistory1760000000025';

  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE shop_slug_history (
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        slug varchar(40) PRIMARY KEY,
        current_slug varchar(40) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX shop_slug_history_shop_id ON shop_slug_history(shop_id);
    `);
  }

  async down(q: QueryRunner) {
    await q.query('DROP TABLE IF EXISTS shop_slug_history');
  }
}
