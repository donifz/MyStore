import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';

export type CustomAttributeType = 'string' | 'number' | 'select';

export type CustomAttribute = {
  id: string;
  shopId: string;
  name: string;
  key: string;
  type: CustomAttributeType;
  options: string[];
  filterable: boolean;
  createdAt: string;
};

export type CreateCustomAttributeInput = {
  name: string;
  key?: string;
  type: CustomAttributeType;
  options?: string[];
  filterable?: boolean;
};

@Injectable()
export class ShopCustomAttributesService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  async list(shopId: string): Promise<CustomAttribute[]> {
    const rows = await this.db.query(
      `SELECT id, shop_id as "shopId", name, key, type, options, filterable, created_at as "createdAt"
       FROM shop_custom_attributes
       WHERE shop_id = $1
       ORDER BY created_at ASC`,
      [shopId],
    );
    return rows.map((r: any) => ({
      ...r,
      options: Array.isArray(r.options) ? r.options : [],
      filterable: Boolean(r.filterable),
    }));
  }

  async create(
    shopId: string,
    input: CreateCustomAttributeInput,
  ): Promise<CustomAttribute> {
    const name = (input.name || '').trim();
    if (!name || name.length > 80) {
      throw new BadRequestException(
        'Название свойства должно быть от 1 до 80 символов',
      );
    }
    const type = input.type;
    if (!['string', 'number', 'select'].includes(type)) {
      throw new BadRequestException(
        'Тип свойства должен быть string, number или select',
      );
    }

    // Generate slug key if omitted or clean it
    let key = (input.key || '').trim().toLowerCase();
    if (!key) {
      key = this.slugify(name);
    }
    key = key.replace(/[^a-z0-9_-]/g, '_').slice(0, 50);
    if (!key) {
      key = 'attr_' + Math.random().toString(36).slice(2, 8);
    }

    const options =
      type === 'select' && Array.isArray(input.options)
        ? input.options.map((o) => String(o).trim()).filter(Boolean)
        : [];

    const filterable = input.filterable !== false;

    try {
      const [row] = await this.db.query(
        `INSERT INTO shop_custom_attributes (shop_id, name, key, type, options, filterable)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, shop_id as "shopId", name, key, type, options, filterable, created_at as "createdAt"`,
        [shopId, name, key, type, JSON.stringify(options), filterable],
      );
      return {
        ...row,
        options: Array.isArray(row.options) ? row.options : [],
        filterable: Boolean(row.filterable),
      };
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException(
          'Свойство с таким ключом уже существует в этом магазине',
        );
      }
      throw err;
    }
  }

  async delete(shopId: string, id: string): Promise<void> {
    const result = await this.db.query(
      `DELETE FROM shop_custom_attributes WHERE id = $1 AND shop_id = $2`,
      [id, shopId],
    );
    if (result[1] === 0) {
      throw new NotFoundException('Свойство не найдено');
    }
  }

  async listStorefront(slug: string): Promise<CustomAttribute[]> {
    const rows = await this.db.query(
      `SELECT a.id, a.shop_id as "shopId", a.name, a.key, a.type, a.options, a.filterable, a.created_at as "createdAt"
       FROM shop_custom_attributes a
       JOIN shops s ON s.id = a.shop_id
       WHERE s.slug = $1 AND a.filterable = true
       ORDER BY a.created_at ASC`,
      [slug],
    );
    return rows.map((r: any) => ({
      ...r,
      options: Array.isArray(r.options) ? r.options : [],
      filterable: true,
    }));
  }

  private slugify(text: string): string {
    const ru: Record<string, string> = {
      а: 'a',
      б: 'b',
      в: 'v',
      г: 'g',
      д: 'd',
      е: 'e',
      ё: 'yo',
      ж: 'zh',
      з: 'z',
      и: 'i',
      й: 'y',
      к: 'k',
      л: 'l',
      м: 'm',
      н: 'n',
      о: 'o',
      п: 'p',
      р: 'r',
      с: 's',
      т: 't',
      у: 'u',
      ф: 'f',
      х: 'h',
      ц: 'ts',
      ч: 'ch',
      ш: 'sh',
      щ: 'sch',
      ъ: '',
      ы: 'y',
      ь: '',
      э: 'e',
      ю: 'yu',
      я: 'ya',
    };
    return text
      .toLowerCase()
      .split('')
      .map((char) => ru[char] || char)
      .join('')
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 40);
  }
}
