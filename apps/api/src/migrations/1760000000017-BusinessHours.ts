import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessHours1760000000017 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE shops
      ADD COLUMN time_zone text NOT NULL DEFAULT 'Asia/Bishkek',
      ADD COLUMN business_schedule jsonb,
      ADD CONSTRAINT shops_business_schedule_shape CHECK (
        business_schedule IS NULL OR
        CASE WHEN jsonb_typeof(business_schedule)='array'
          THEN jsonb_array_length(business_schedule)=7 ELSE false END
      )`);
  }
  async down(q: QueryRunner) {
    await q.query(`ALTER TABLE shops DROP CONSTRAINT shops_business_schedule_shape,
      DROP COLUMN business_schedule, DROP COLUMN time_zone`);
  }
}
