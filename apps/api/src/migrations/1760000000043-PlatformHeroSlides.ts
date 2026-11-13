import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformHeroSlides1760000000043 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS platform_hero_slides (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sort_order int NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        badge text NOT NULL DEFAULT '',
        title text NOT NULL,
        subtitle text NOT NULL DEFAULT '',
        button_text text NOT NULL DEFAULT 'Смотреть товары',
        button_url text NOT NULL DEFAULT '#catalog',
        image_url text,
        bg_gradient text NOT NULL DEFAULT 'blue',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS platform_hero_slides_sort_idx
        ON platform_hero_slides(sort_order, created_at);

      INSERT INTO platform_hero_slides (sort_order, is_active, badge, title, subtitle, button_text, button_url, image_url, bg_gradient)
      VALUES
        (0, true, 'МАРКЕТПЛЕЙС МАГАЗИНОВ', 'Товары рядом', 'Смотрите наличие и забирайте в магазине', 'Смотреть товары', '#catalog', '/banners/banner-shops.jpg', 'blue'),
        (1, true, 'СКИДКИ И АКЦИИ', 'Скидки до 50%', 'Сезонные предложения от магазинов вашего города', 'Смотреть скидки', '#catalog', '/banners/banner-sale.jpg', 'indigo'),
        (2, true, 'БЫСТРАЯ ДОСТАВКА', 'Быстрая доставка', 'Забирайте сами или закажите курьером прямо до двери', 'Магазины рядом', '/shops', '/banners/banner-delivery.jpg', 'emerald');
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS platform_hero_slides;`);
  }
}
