import { MigrationInterface, QueryRunner } from 'typeorm';
export class Initial1760000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
 CREATE TABLE shops(id uuid PRIMARY KEY,name text NOT NULL);
 CREATE TABLE users(id uuid PRIMARY KEY,email text NOT NULL UNIQUE,password_hash text NOT NULL);
 CREATE TABLE memberships(shop_id uuid NOT NULL REFERENCES shops(id),user_id uuid NOT NULL REFERENCES users(id),role text NOT NULL CHECK(role IN ('owner','manager','cashier')),PRIMARY KEY(shop_id,user_id));
 CREATE TABLE sessions(token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),expires_at timestamptz NOT NULL);
 CREATE INDEX sessions_expiry ON sessions(expires_at);
 `);
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE sessions,memberships,users,shops');
  }
}
