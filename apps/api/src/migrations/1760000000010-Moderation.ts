import { MigrationInterface, QueryRunner } from 'typeorm';

export class Moderation1760000000010 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE platform_admins (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  async down(q: QueryRunner) {
    await q.query('DROP TABLE platform_admins');
  }
}
