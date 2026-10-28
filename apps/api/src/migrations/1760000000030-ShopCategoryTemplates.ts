import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShopCategoryTemplates1760000000030 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE shop_types (
        code varchar(32) PRIMARY KEY,
        name varchar(80) NOT NULL UNIQUE
      );
      INSERT INTO shop_types(code,name) VALUES
        ('general','Универсальный магазин'),
        ('toys','Игрушки'),
        ('grocery','Продукты питания'),
        ('fashion','Одежда и обувь'),
        ('electronics','Электроника'),
        ('home','Товары для дома');

      ALTER TABLE partner_applications
        ADD COLUMN shop_type varchar(32) NOT NULL DEFAULT 'general'
        REFERENCES shop_types(code);
      ALTER TABLE shops
        ADD COLUMN shop_type varchar(32) NOT NULL DEFAULT 'general'
        REFERENCES shop_types(code);

      CREATE TABLE platform_categories (
        code varchar(40) PRIMARY KEY,
        name varchar(80) NOT NULL UNIQUE
      );
      INSERT INTO platform_categories(code,name) VALUES
        ('toys','Игрушки'),
        ('electronics','Электроника'),
        ('fashion','Одежда и обувь'),
        ('grocery','Продукты питания'),
        ('home','Товары для дома'),
        ('other','Другое');

      CREATE TABLE shop_category_templates (
        shop_type varchar(32) NOT NULL REFERENCES shop_types(code),
        name varchar(80) NOT NULL,
        parent_name varchar(80) NOT NULL DEFAULT '',
        platform_category_code varchar(40) NOT NULL REFERENCES platform_categories(code),
        PRIMARY KEY(shop_type,parent_name,name)
      );

      INSERT INTO shop_category_templates(shop_type,name,parent_name,platform_category_code) VALUES
        ('toys','Конструкторы','','toys'),
        ('toys','Блочные конструкторы','Конструкторы','toys'),
        ('toys','Магнитные конструкторы','Конструкторы','toys'),
        ('toys','Механические модели','Конструкторы','toys'),
        ('toys','Робототехника','','toys'),
        ('toys','Arduino для детей','Робототехника','toys'),
        ('toys','Роботы и датчики','Робототехника','toys'),
        ('toys','STEM-наборы','Робототехника','toys'),
        ('toys','Развивающие игрушки','','toys'),
        ('toys','Пазлы','Развивающие игрушки','toys'),
        ('toys','Логические игры','Развивающие игрушки','toys'),
        ('toys','Обучающие наборы','Развивающие игрушки','toys'),
        ('toys','Куклы и фигурки','','toys'),
        ('toys','Куклы','Куклы и фигурки','toys'),
        ('toys','Фигурки','Куклы и фигурки','toys'),
        ('toys','Настольные игры','','toys'),
        ('toys','Семейные игры','Настольные игры','toys'),
        ('toys','Детские игры','Настольные игры','toys'),
        ('toys','Радиоуправляемые игрушки','','toys'),
        ('toys','Машинки','Радиоуправляемые игрушки','toys'),
        ('toys','Роботы на управлении','Радиоуправляемые игрушки','toys'),
        ('grocery','Бакалея','','grocery'),
        ('grocery','Молочные продукты','','grocery'),
        ('grocery','Овощи и фрукты','','grocery'),
        ('grocery','Напитки','','grocery'),
        ('fashion','Женская одежда','','fashion'),
        ('fashion','Мужская одежда','','fashion'),
        ('fashion','Детская одежда','','fashion'),
        ('fashion','Обувь','','fashion'),
        ('electronics','Смартфоны','','electronics'),
        ('electronics','Ноутбуки','','electronics'),
        ('electronics','Компьютеры','','electronics'),
        ('electronics','Аксессуары','','electronics'),
        ('home','Посуда','','home'),
        ('home','Мебель','','home'),
        ('home','Текстиль','','home'),
        ('home','Декор','','home');

      ALTER TABLE shop_categories
        ADD COLUMN platform_category_code varchar(40)
        REFERENCES platform_categories(code);
      CREATE INDEX shop_categories_platform_category_idx
        ON shop_categories(shop_id,platform_category_code)
        WHERE platform_category_code IS NOT NULL;
    `);
  }

  async down(q: QueryRunner) {
    await q.query(`
      DROP INDEX shop_categories_platform_category_idx;
      ALTER TABLE shop_categories DROP COLUMN platform_category_code;
      DROP TABLE shop_category_templates;
      DROP TABLE platform_categories;
      ALTER TABLE shops DROP COLUMN shop_type;
      ALTER TABLE partner_applications DROP COLUMN shop_type;
      DROP TABLE shop_types;
    `);
  }
}
