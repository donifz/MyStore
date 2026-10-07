import { MigrationInterface, QueryRunner } from 'typeorm';
export class Categories1760000000009 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE shop_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        parent_id uuid NULL,
        name text NOT NULL,
        built_in boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(shop_id,id),
        FOREIGN KEY(shop_id,parent_id) REFERENCES shop_categories(shop_id,id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX shop_categories_root_name_unique ON shop_categories(shop_id,lower(name)) WHERE parent_id IS NULL;
      CREATE UNIQUE INDEX shop_categories_child_name_unique ON shop_categories(shop_id,parent_id,lower(name)) WHERE parent_id IS NOT NULL;
      ALTER TABLE variants ADD COLUMN subcategory text NOT NULL DEFAULT '';
      INSERT INTO shop_categories(shop_id,name,built_in)
        SELECT DISTINCT shop_id,trim(category),false FROM variants WHERE trim(category)<>''
        ON CONFLICT DO NOTHING;
    `);
  }
  async down(q: QueryRunner) {
    await q.query(
      'ALTER TABLE variants DROP COLUMN subcategory; DROP TABLE shop_categories',
    );
  }
}
