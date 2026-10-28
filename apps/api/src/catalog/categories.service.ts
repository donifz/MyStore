import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
import { DEFAULT_CATEGORIES } from './category-options';

@Injectable()
export class CategoriesService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  private async ensureDefaults(shopId: string) {
    const [shop] = await this.db.query(
      'SELECT shop_type FROM shops WHERE id=$1',
      [shopId],
    );
    if (!shop) throw new BadRequestException('Shop not found');
    if (shop.shop_type !== 'general') {
      const templates = await this.db.query(
        'SELECT name,parent_name,platform_category_code FROM shop_category_templates WHERE shop_type=$1 ORDER BY parent_name,name',
        [shop.shop_type],
      );
      const roots = templates.filter((row: any) => !row.parent_name);
      for (const root of roots) {
        const [existing] = await this.db.query(
          'SELECT id FROM shop_categories WHERE shop_id=$1 AND parent_id IS NULL AND lower(name)=lower($2)',
          [shopId, root.name],
        );
        const [inserted] = existing
          ? [existing]
          : await this.db.query(
              'INSERT INTO shop_categories(shop_id,name,built_in,platform_category_code) VALUES($1,$2,true,$3) ON CONFLICT DO NOTHING RETURNING id',
              [shopId, root.name, root.platform_category_code],
            );
        const parentId = inserted?.id;
        if (!parentId) continue;
        await this.db.query(
          'UPDATE shop_categories SET platform_category_code=$3 WHERE id=$1 AND shop_id=$2 AND platform_category_code IS NULL',
          [parentId, shopId, root.platform_category_code],
        );
        for (const child of templates.filter(
          (row: any) => row.parent_name === root.name,
        )) {
          await this.db.query(
            'INSERT INTO shop_categories(shop_id,parent_id,name,built_in,platform_category_code) VALUES($1,$2,$3,true,$4) ON CONFLICT DO NOTHING',
            [shopId, parentId, child.name, child.platform_category_code],
          );
        }
      }
      return;
    }
    for (const category of DEFAULT_CATEGORIES) {
      const [root] = await this.db.query(
        `INSERT INTO shop_categories(shop_id,name,built_in) VALUES($1,$2,true)
         ON CONFLICT (shop_id,lower(name)) WHERE parent_id IS NULL DO UPDATE SET built_in=true
         RETURNING id`,
        [shopId, category.name],
      );
      if (!root) continue;
      for (const name of category.children) {
        await this.db.query(
          `INSERT INTO shop_categories(shop_id,parent_id,name,built_in) VALUES($1,$2,$3,true)
           ON CONFLICT (shop_id,parent_id,lower(name)) WHERE parent_id IS NOT NULL DO NOTHING`,
          [shopId, root.id, name],
        );
      }
    }
  }

  async list(shopId: string) {
    await this.ensureDefaults(shopId);
    const rows = await this.db.query(
      'SELECT id,parent_id,name,built_in,platform_category_code FROM shop_categories WHERE shop_id=$1 ORDER BY parent_id NULLS FIRST, lower(name)',
      [shopId],
    );
    const roots = rows
      .filter((r: any) => !r.parent_id)
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        builtIn: r.built_in,
        platformCategoryCode: r.platform_category_code,
        parentId: null as string | null,
        children: [] as any[],
      }));
    const byId = new Map(roots.map((r: any) => [r.id, r]));
    for (const row of rows.filter((r: any) => r.parent_id)) {
      const parent: any = byId.get(row.parent_id);
      if (parent)
        parent.children.push({
          id: row.id,
          name: row.name,
          builtIn: row.built_in,
          platformCategoryCode: row.platform_category_code,
          parentId: row.parent_id,
        });
    }
    return roots;
  }

  async create(shopId: string, name: string, parentId?: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80)
      throw new BadRequestException('Invalid category name');
    if (parentId) {
      const [parent] = await this.db.query(
        'SELECT id FROM shop_categories WHERE shop_id=$1 AND id=$2 AND parent_id IS NULL',
        [shopId, parentId],
      );
      if (!parent)
        throw new BadRequestException('Parent must be a top-level category');
    }
    try {
      const [row] = await this.db.query(
        'INSERT INTO shop_categories(shop_id,parent_id,name,built_in) VALUES($1,$2,$3,false) RETURNING id,parent_id,name,built_in',
        [shopId, parentId ?? null, trimmed],
      );
      return {
        id: row.id,
        parentId: row.parent_id,
        name: row.name,
        builtIn: row.built_in,
      };
    } catch (e: any) {
      if (e.code === '23505')
        throw new ConflictException('Такая категория уже существует');
      throw e;
    }
  }

  async assertSelection(shopId: string, category: string, subcategory = '') {
    if (!category && !subcategory) return;
    const roots: { name: string; children: { name: string }[] }[] =
      await this.list(shopId);
    const root = roots.find((item) => item.name === category);
    if (
      !root ||
      (subcategory &&
        !root.children.some((child) => child.name === subcategory))
    ) {
      throw new BadRequestException(
        'Выберите категорию и подкатегорию из списка',
      );
    }
  }
}
