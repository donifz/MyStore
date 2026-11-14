import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformHeroSlidesEnhancements1760000000044 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE platform_hero_slides
        ADD COLUMN IF NOT EXISTS mobile_image_url text,
        ADD COLUMN IF NOT EXISTS hide_overlay boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS only_image boolean NOT NULL DEFAULT false;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE platform_hero_slides
        DROP COLUMN IF EXISTS mobile_image_url,
        DROP COLUMN IF EXISTS hide_overlay,
        DROP COLUMN IF EXISTS only_image;
    `);
  }
}
