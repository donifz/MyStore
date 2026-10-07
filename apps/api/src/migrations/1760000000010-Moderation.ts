import { MigrationInterface, QueryRunner } from 'typeorm';

export class Moderation1760000000010 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE platform_admins (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE partner_applications (
        id uuid PRIMARY KEY,
        shop_name text NOT NULL,
        email text NOT NULL,
        phone text NOT NULL,
        city text NOT NULL,
        address text NOT NULL,
        category text NOT NULL,
        agreed_at timestamptz NOT NULL DEFAULT now(),
        status text NOT NULL DEFAULT 'new'
          CHECK (status IN ('new','in_review','approved','rejected')),
        rejection_reason text,
        shop_id uuid UNIQUE REFERENCES shops(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX partner_applications_pending_email
        ON partner_applications(email) WHERE status IN ('new','in_review');
      CREATE INDEX partner_applications_status_date
        ON partner_applications(status,created_at DESC,id);
      CREATE TABLE partner_application_events (
        id bigserial PRIMARY KEY,
        application_id uuid NOT NULL REFERENCES partner_applications(id),
        status text NOT NULL,
        actor_id uuid REFERENCES users(id),
        reason text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE partner_invitations (
        application_id uuid PRIMARY KEY REFERENCES partner_applications(id),
        token_hash text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        used_at timestamptz
      );
      CREATE TABLE product_publications (
        variant_id uuid PRIMARY KEY REFERENCES variants(id) ON DELETE CASCADE,
        shop_id uuid NOT NULL REFERENCES shops(id),
        name text NOT NULL,
        description text NOT NULL,
        category text NOT NULL,
        subcategory text NOT NULL,
        photo_data bytea,
        approved_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX product_publications_shop_category ON product_publications(shop_id,category);
      CREATE TABLE product_publication_revisions (
        id uuid PRIMARY KEY,
        variant_id uuid NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
        shop_id uuid NOT NULL REFERENCES shops(id),
        name text NOT NULL,
        description text NOT NULL,
        category text NOT NULL,
        subcategory text NOT NULL,
        photo_data bytea,
        status text NOT NULL CHECK(status IN ('pending','approved','rejected')),
        submitted_by uuid REFERENCES users(id),
        decided_by uuid REFERENCES users(id),
        reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        decided_at timestamptz
      );
      CREATE UNIQUE INDEX product_revisions_one_pending ON product_publication_revisions(variant_id) WHERE status='pending';
      CREATE INDEX product_revisions_pending_date ON product_publication_revisions(created_at,id) WHERE status='pending';
      INSERT INTO product_publications(variant_id,shop_id,name,description,category,subcategory,photo_data)
        SELECT id,shop_id,name,description,category,subcategory,photo_data
        FROM variants WHERE published;
    `);
  }

  async down(q: QueryRunner) {
    await q.query(
      'DROP TABLE product_publication_revisions,product_publications,partner_invitations,partner_application_events,partner_applications,platform_admins',
    );
  }
}
