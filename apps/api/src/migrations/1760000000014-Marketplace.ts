import { MigrationInterface, QueryRunner } from 'typeorm';
export class Marketplace1760000000014 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `ALTER TABLE shops ADD COLUMN district varchar(80) NOT NULL DEFAULT '', ADD COLUMN pickup_enabled boolean NOT NULL DEFAULT true, ADD COLUMN delivery_enabled boolean NOT NULL DEFAULT false`,
    );
  }
  async down(q: QueryRunner) {
    await q.query(
      'ALTER TABLE shops DROP COLUMN district, DROP COLUMN pickup_enabled, DROP COLUMN delivery_enabled',
    );
  }
}
