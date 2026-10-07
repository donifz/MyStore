import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { DATABASE } from '../database';
import { hashPassword } from '../auth/password';
export type ProfileInput = {
  description: string;
  city: string;
  address: string;
  phone: string;
  hours: string;
  published: boolean;
};
export type PublicQuery = {
  q: string;
  page: number;
  pageSize: number;
  store: string;
  category: string;
  inStock: string;
  sort: string;
};
const escaped = (q: string) => '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
@Injectable()
export class StorefrontService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}
  async owner(userId: string, shopId: string) {
    const [m] = await this.db.query(
      "SELECT 1 FROM memberships WHERE shop_id=$1 AND user_id=$2 AND role='owner'",
      [shopId, userId],
    );
    if (!m) throw new ForbiddenException();
  }
  async profile(shopId: string) {
    const [r] = await this.db.query(
      'SELECT name,slug,description,city,address,phone,hours,published FROM shops WHERE id=$1',
      [shopId],
    );
    if (!r) throw new NotFoundException();
    return r;
  }
  async updateProfile(shopId: string, input: ProfileInput) {
    if (
      input.published &&
      (!input.city.trim() ||
        !/^\+?[\d\s()-]{7,30}$/.test(input.phone.trim()) ||
        !/^\d{7,15}$/.test(input.phone.replace(/\D/g, '')))
    )
      throw new BadRequestException('City and phone required for publication');
    await this.db.query(
      'UPDATE shops SET description=$2,city=$3,address=$4,phone=$5,hours=$6,published=$7 WHERE id=$1',
      [
        shopId,
        input.description.trim(),
        input.city.trim(),
        input.address.trim(),
        input.phone.trim(),
        input.hours.trim(),
        input.published,
      ],
    );
    return this.profile(shopId);
  }
  async register(input: { email: string; password: string; shopName: string }) {
    try {
      await this.db.transaction(async (q) => {
        const user = randomUUID(),
          shop = randomUUID();
        await q.query(
          'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',
          [
            user,
            input.email.trim().toLowerCase(),
            await hashPassword(input.password),
          ],
        );
        await q.query('INSERT INTO shops(id,name) VALUES($1,$2)', [
          shop,
          input.shopName.trim(),
        ]);
        await q.query(
          "INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,'owner')",
          [shop, user],
        );
      });
    } catch (e: any) {
      if (e.code === '23505')
        throw new ConflictException('Registration unavailable for this email');
      throw e;
    }
    return { created: true };
  }
  async stores(q: string, page: number, pageSize: number) {
    const params = [escaped(q)];
    const where = 'published AND (name ILIKE $1 OR city ILIKE $1)';
    const [count] = await this.db.query(
      'SELECT count(*)::int total FROM shops WHERE ' + where,
      params,
    );
    const items = await this.db.query(
      'SELECT name,slug,description,city FROM shops WHERE ' +
        where +
        ' ORDER BY name,slug LIMIT $2 OFFSET $3',
      [...params, pageSize, (page - 1) * pageSize],
    );
    return { items, total: count.total, page, pageSize };
  }
  async store(slug: string) {
    const [r] = await this.db.query(
      'SELECT name,slug,description,city,address,phone,hours FROM shops WHERE slug=$1 AND published',
      [slug],
    );
    if (!r) throw new NotFoundException();
    return r;
  }
  private productDto(r: any, detail = false) {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      salePriceMinor: Number(r.sale_price_minor),
      available: Number(r.available),
      store: {
        slug: r.slug,
        name: r.shop_name,
        city: r.city,
        ...(detail
          ? { phone: r.phone, address: r.address, hours: r.hours }
          : {}),
      },
    };
  }
  private select = `SELECT v.id,v.name,v.description,v.category,v.sale_price_minor,COALESCE(b.physical,0)-COALESCE(b.reserved,0) available,s.slug,s.name shop_name,s.city,s.phone,s.address,s.hours FROM variants v JOIN shops s ON s.id=v.shop_id LEFT JOIN stock_balances b ON b.shop_id=v.shop_id AND b.variant_id=v.id`;
  async products(query: PublicQuery) {
    const { q, page, pageSize, store, category, inStock, sort } = query;
    if (store) await this.store(store);
    const where = `s.published AND v.published AND (v.name ILIKE $1 OR s.name ILIKE $1) AND ($2='' OR s.slug=$2) AND ($3='' OR v.category=$3) AND ($4=false OR COALESCE(b.physical,0)-COALESCE(b.reserved,0)>0)`;
    const params = [escaped(q), store, category, inStock === 'true'];
    const rows = await this.db.query(
      this.select +
        ' WHERE ' +
        where +
        ' ORDER BY ' +
        (sort === 'price-asc'
          ? 'v.sale_price_minor ASC,'
          : sort === 'price-desc'
            ? 'v.sale_price_minor DESC,'
            : '') +
        ' v.name,v.id LIMIT $5 OFFSET $6',
      [...params, pageSize, (page - 1) * pageSize],
    );
    const [count] = await this.db.query(
      'SELECT count(*)::int total FROM variants v JOIN shops s ON s.id=v.shop_id LEFT JOIN stock_balances b ON b.shop_id=v.shop_id AND b.variant_id=v.id WHERE ' +
        where,
      params,
    );
    const cats = await this.db.query(
      "SELECT DISTINCT v.category FROM variants v JOIN shops s ON s.id=v.shop_id WHERE s.published AND v.published AND v.category<>'' AND ($1='' OR s.slug=$1) ORDER BY v.category",
      [store],
    );
    return {
      items: rows.map((r: any) => this.productDto(r)),
      total: count.total,
      page,
      pageSize,
      categories: cats.map((r: any) => r.category),
    };
  }
  async product(slug: string, id: string) {
    const [r] = await this.db.query(
      this.select +
        ' WHERE s.published AND v.published AND s.slug=$1 AND v.id=$2',
      [slug, id],
    );
    if (!r) throw new NotFoundException();
    return this.productDto(r, true);
  }
}
