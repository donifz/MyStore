import { MigrationInterface, QueryRunner } from 'typeorm';

export class CanonicalStorefrontSettings1760000000027 implements MigrationInterface {
  name = 'CanonicalStorefrontSettings1760000000027';

  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE shop_slugs (
        slug varchar(40) PRIMARY KEY CHECK (slug = lower(slug)),
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        is_current boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX shop_slugs_one_current_per_shop
        ON shop_slugs(shop_id) WHERE is_current;

      INSERT INTO shop_slugs(slug,shop_id,is_current)
      SELECT lower(slug),id,true FROM shops;

      INSERT INTO shop_slugs(slug,shop_id,is_current)
      SELECT lower(slug),shop_id,false FROM shop_slug_history
      ON CONFLICT (slug) DO NOTHING;
    `);
  }

  async down(q: QueryRunner) {
    await q.query('DROP TABLE IF EXISTS shop_slugs');
  }
}
