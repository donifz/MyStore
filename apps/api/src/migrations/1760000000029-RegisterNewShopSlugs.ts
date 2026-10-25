import { MigrationInterface, QueryRunner } from 'typeorm';

export class RegisterNewShopSlugs1760000000029 implements MigrationInterface {
  name = 'RegisterNewShopSlugs1760000000029';

  async up(q: QueryRunner) {
    await q.query(`
      CREATE FUNCTION register_new_shop_slug() RETURNS trigger AS $$
      BEGIN
        INSERT INTO shop_slugs(slug,shop_id,is_current)
        VALUES(lower(NEW.slug),NEW.id,true);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER shops_register_initial_slug
      AFTER INSERT ON shops
      FOR EACH ROW EXECUTE FUNCTION register_new_shop_slug();
    `);
  }

  async down(q: QueryRunner) {
    await q.query(`
      DROP TRIGGER IF EXISTS shops_register_initial_slug ON shops;
      DROP FUNCTION IF EXISTS register_new_shop_slug();
    `);
  }
}
