import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffPermissions1760000000018 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE memberships
      ADD COLUMN can_return boolean NOT NULL DEFAULT false,
      ADD COLUMN can_view_reports boolean NOT NULL DEFAULT false`);
  }
  async down(q: QueryRunner) {
    await q.query(
      'ALTER TABLE memberships DROP COLUMN can_return, DROP COLUMN can_view_reports',
    );
  }
}
