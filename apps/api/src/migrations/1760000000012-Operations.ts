import { MigrationInterface, QueryRunner } from 'typeorm';

export class Operations1760000000012 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        kind text NOT NULL,
        title text NOT NULL,
        body text NOT NULL,
        entity_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        read_at timestamptz
      );
      CREATE INDEX notifications_shop_date ON notifications(shop_id,created_at DESC,id);

      CREATE TABLE outbox_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
        topic text NOT NULL,
        entity_id uuid,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        attempts int NOT NULL DEFAULT 0,
        available_at timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX outbox_pending ON outbox_events(available_at,id) WHERE processed_at IS NULL;

      CREATE TABLE audit_log (
        id bigserial PRIMARY KEY,
        shop_id uuid REFERENCES shops(id) ON DELETE SET NULL,
        actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
        action text NOT NULL,
        entity_type text NOT NULL,
        entity_id uuid,
        details jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX audit_log_shop_date ON audit_log(shop_id,created_at DESC,id);

      CREATE TABLE fiscal_receipts (
        shop_id uuid NOT NULL REFERENCES shops(id),
        sale_id uuid NOT NULL,
        provider text NOT NULL,
        status text NOT NULL CHECK(status IN ('pending','succeeded','failed')),
        external_id text,
        fiscal_number text,
        error text,
        requested_by uuid NOT NULL REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(shop_id,sale_id),
        FOREIGN KEY(shop_id,sale_id) REFERENCES stock_documents(shop_id,id)
      );

      CREATE FUNCTION audit_stock_document() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
        VALUES(NEW.shop_id,NEW.actor_id,'posted','stock_document',NEW.id,
          jsonb_build_object('kind',NEW.kind,'totalMinor',NEW.total_minor));
        RETURN NEW;
      END $$;
      CREATE TRIGGER audit_stock_documents AFTER INSERT ON stock_documents
      FOR EACH ROW EXECUTE FUNCTION audit_stock_document();

      CREATE FUNCTION audit_payment() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
        VALUES(NEW.shop_id,NEW.actor_id,NEW.kind,'payment',NEW.id,
          jsonb_build_object('documentId',NEW.document_id,'method',NEW.method,'amountMinor',NEW.amount_minor));
        RETURN NEW;
      END $$;
      CREATE TRIGGER audit_payments AFTER INSERT ON payment_records
      FOR EACH ROW EXECUTE FUNCTION audit_payment();

      CREATE FUNCTION audit_order_status() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
          INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
          VALUES(NEW.shop_id,NEW.issued_by,'status:'||NEW.status,'online_order',NEW.id,
            jsonb_build_object('previous',CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,'totalMinor',NEW.total_minor));
          INSERT INTO notifications(shop_id,kind,title,body,entity_id)
          VALUES(NEW.shop_id,'order',
            CASE WHEN TG_OP='INSERT' THEN 'Новый заказ' ELSE 'Статус заказа изменён' END,
            'Заказ '||NEW.id::text||': '||NEW.status,NEW.id);
          INSERT INTO outbox_events(shop_id,topic,entity_id,payload)
          VALUES(NEW.shop_id,'order.status',NEW.id,jsonb_build_object('status',NEW.status));
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER order_status_events AFTER INSERT OR UPDATE OF status ON online_orders
      FOR EACH ROW EXECUTE FUNCTION audit_order_status();

      CREATE FUNCTION product_moderation_events() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.status='pending' AND NEW.status IN ('approved','rejected') THEN
          INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
          VALUES(NEW.shop_id,NEW.decided_by,'moderation:'||NEW.status,'product_revision',NEW.id,
            jsonb_build_object('variantId',NEW.variant_id,'reason',NEW.reason));
          INSERT INTO notifications(shop_id,kind,title,body,entity_id)
          VALUES(NEW.shop_id,'moderation',
            CASE WHEN NEW.status='approved' THEN 'Товар одобрен' ELSE 'Товар отклонён' END,
            CASE WHEN NEW.status='approved' THEN NEW.name ELSE COALESCE(NEW.reason,'Отклонено') END,
            NEW.variant_id);
          INSERT INTO outbox_events(shop_id,topic,entity_id,payload)
          VALUES(NEW.shop_id,'product.moderation',NEW.variant_id,
            jsonb_build_object('status',NEW.status,'revisionId',NEW.id));
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER product_moderation_events AFTER UPDATE OF status ON product_publication_revisions
      FOR EACH ROW EXECUTE FUNCTION product_moderation_events();

      CREATE FUNCTION audit_variant_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.sale_price_minor IS DISTINCT FROM NEW.sale_price_minor OR OLD.published IS DISTINCT FROM NEW.published THEN
          INSERT INTO audit_log(shop_id,action,entity_type,entity_id,details)
          VALUES(NEW.shop_id,'updated','variant',NEW.id,
            jsonb_build_object('priceBefore',OLD.sale_price_minor,'priceAfter',NEW.sale_price_minor,
              'publishedBefore',OLD.published,'publishedAfter',NEW.published));
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER audit_variant_updates AFTER UPDATE ON variants
      FOR EACH ROW EXECUTE FUNCTION audit_variant_update();
    `);
  }

  async down(q: QueryRunner) {
    await q.query(`
      DROP TRIGGER IF EXISTS audit_variant_updates ON variants;
      DROP FUNCTION IF EXISTS audit_variant_update();
      DROP TRIGGER IF EXISTS product_moderation_events ON product_publication_revisions;
      DROP FUNCTION IF EXISTS product_moderation_events();
      DROP TRIGGER IF EXISTS order_status_events ON online_orders;
      DROP FUNCTION IF EXISTS audit_order_status();
      DROP TRIGGER IF EXISTS audit_payments ON payment_records;
      DROP FUNCTION IF EXISTS audit_payment();
      DROP TRIGGER IF EXISTS audit_stock_documents ON stock_documents;
      DROP FUNCTION IF EXISTS audit_stock_document();
      DROP TABLE fiscal_receipts,audit_log,outbox_events,notifications;
    `);
  }
}
