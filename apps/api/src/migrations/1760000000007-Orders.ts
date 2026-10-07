import { MigrationInterface, QueryRunner } from 'typeorm';
export class Orders1760000000007 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE online_orders (
        id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id),
        checkout_hash text NOT NULL UNIQUE, fingerprint text NOT NULL,
        store_name text NOT NULL, name text NOT NULL, phone text NOT NULL,
        fulfillment text NOT NULL CHECK(fulfillment IN ('pickup','delivery')),
        address text NOT NULL, comment text NOT NULL,
        status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','confirmed','ready','issued','cancelled','expired')),
        total_minor bigint NOT NULL CHECK(total_minor BETWEEN 0 AND 9007199254740991),
        expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        sale_id uuid, issued_by uuid REFERENCES users(id),
        UNIQUE(shop_id,id), FOREIGN KEY(shop_id,sale_id) REFERENCES stock_documents(shop_id,id),
        CHECK((status='issued')=(sale_id IS NOT NULL)), CHECK((status='issued')=(issued_by IS NOT NULL))
      );
      CREATE INDEX online_orders_shop_date ON online_orders(shop_id,created_at DESC,id);
      CREATE INDEX online_orders_expiration ON online_orders(expires_at,id) WHERE status='new';
      CREATE INDEX online_orders_phone_pending ON online_orders(shop_id,phone) WHERE status='new';
      CREATE TABLE online_order_lines (
        shop_id uuid NOT NULL, order_id uuid NOT NULL, variant_id uuid NOT NULL,
        name text NOT NULL, barcode text NOT NULL,
        quantity bigint NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),
        unit_price_minor bigint NOT NULL CHECK(unit_price_minor BETWEEN 0 AND 9007199254740991),
        PRIMARY KEY(shop_id,order_id,variant_id),
        FOREIGN KEY(shop_id,order_id) REFERENCES online_orders(shop_id,id),
        FOREIGN KEY(shop_id,variant_id) REFERENCES variants(shop_id,id)
      );
      CREATE TRIGGER online_order_lines_immutable BEFORE UPDATE OR DELETE ON online_order_lines FOR EACH ROW EXECUTE FUNCTION deny_movement_changes();
    `);
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE online_order_lines; DROP TABLE online_orders');
  }
}
