import { MigrationInterface, QueryRunner } from 'typeorm';
export class PlatformFinancialAccess1760000000019 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE platform_financial_grants(
      id uuid PRIMARY KEY,shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      admin_user_id uuid NOT NULL REFERENCES users(id),granted_by uuid NOT NULL REFERENCES users(id),
      purpose text NOT NULL CHECK(length(trim(purpose)) BETWEEN 1 AND 500),
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL,
      revoked_at timestamptz,revoked_by uuid REFERENCES users(id),
      CHECK((revoked_at IS NULL)=(revoked_by IS NULL)));
      CREATE INDEX platform_grants_shop_date ON platform_financial_grants(shop_id,created_at DESC,id);
      CREATE INDEX platform_grants_admin_date ON platform_financial_grants(admin_user_id,created_at DESC,id)`);
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE platform_financial_grants');
  }
}
