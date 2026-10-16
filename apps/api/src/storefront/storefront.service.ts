import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
export type ProfileInput = {
  district?: string;
  pickupEnabled?: boolean;
  deliveryEnabled?: boolean;
  description: string;
  city: string;
  address: string;
  phone: string;
  hours: string;
  published: boolean;
};
export type PublicQuery = {
  city?: string;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
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
      'SELECT name,slug,description,city,address,phone,hours,published,district,pickup_enabled AS "pickupEnabled",delivery_enabled AS "deliveryEnabled" FROM shops WHERE id=$1',
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
    const current = await this.profile(shopId);
    if (
      !(input.pickupEnabled ?? current.pickupEnabled) &&
      !(input.deliveryEnabled ?? current.deliveryEnabled)
    )
      throw new BadRequestException('Enable at least one fulfillment method');
    await this.db.query(
      'UPDATE shops SET description=$2,city=$3,address=$4,phone=$5,hours=$6,published=$7,district=COALESCE($8,district),pickup_enabled=COALESCE($9,pickup_enabled),delivery_enabled=COALESCE($10,delivery_enabled) WHERE id=$1',
      [
        shopId,
        input.description.trim(),
        input.city.trim(),
        input.address.trim(),
        input.phone.trim(),
        input.hours.trim(),
        input.published,
        input.district?.trim() ?? null,
        input.pickupEnabled ?? null,
        input.deliveryEnabled ?? null,
      ],
    );
    return this.profile(shopId);
  }
  async filters() {
    const locations = await this.db.query(
      "SELECT DISTINCT city,district FROM shops WHERE published AND city<>'' ORDER BY city,district",
    );
    const categories = await this.db.query(
      "SELECT DISTINCT p.category FROM product_publications p JOIN variants v ON v.id=p.variant_id JOIN shops s ON s.id=v.shop_id WHERE s.published AND v.published AND p.category<>'' ORDER BY p.category",
    );
    return { locations, categories: categories.map((r: any) => r.category) };
  }
  async stores(
    q: string,
    page: number,
    pageSize: number,
    filters: { city?: string; district?: string; category?: string } = {},
  ) {
    const params = [
      escaped(q),
      filters.city || '',
      filters.district || '',
      filters.category || '',
    ];
    const where = `s.published AND (s.name ILIKE $1 OR s.city ILIKE $1) AND ($2='' OR s.city=$2) AND ($3='' OR s.district=$3) AND ($4='' OR EXISTS (SELECT 1 FROM variants v JOIN product_publications p ON p.variant_id=v.id WHERE v.shop_id=s.id AND v.published AND p.category=$4))`;
    const [count] = await this.db.query(
      'SELECT count(*)::int total FROM shops s WHERE ' + where,
      params,
    );
    const items = await this.db.query(
      `SELECT s.name,s.slug,s.description,s.city,s.district,s.address,s.phone,s.hours,s.pickup_enabled AS "pickupEnabled",s.delivery_enabled AS "deliveryEnabled",(SELECT count(*)::int FROM variants v JOIN product_publications p ON p.variant_id=v.id WHERE v.shop_id=s.id AND v.published) AS "productCount",ARRAY(SELECT DISTINCT p.category FROM variants v JOIN product_publications p ON p.variant_id=v.id WHERE v.shop_id=s.id AND v.published AND p.category<>'' ORDER BY p.category LIMIT 3) AS categories FROM shops s WHERE ` +
        where +
        ' ORDER BY s.name,s.slug LIMIT $5 OFFSET $6',
      [...params, pageSize, (page - 1) * pageSize],
    );
    return { items, total: count.total, page, pageSize };
  }
  async store(slug: string) {
    const [r] = await this.db.query(
      'SELECT name,slug,description,city,address,phone,hours,district,pickup_enabled AS "pickupEnabled",delivery_enabled AS "deliveryEnabled" FROM shops WHERE slug=$1 AND published',
      [slug],
    );
    if (!r) throw new NotFoundException();
    return r;
  }
  private productDto(r: any, detail = false) {
    return {
      id: r.id,
      size: r.size ?? '',
      color: r.color ?? '',
      ...(r.has_photo
        ? {
            photoUrl: `/api/public/stores/${r.slug}/products/${r.id}/photo`,
            photoUrls: Array.from(
              { length: Math.min(Number(r.photo_count) || 1, 8) },
              (_, i) =>
                `/api/public/stores/${r.slug}/products/${r.id}/photo?index=${i}`,
            ),
          }
        : {}),
      name: r.name,
      description: r.description,
      category: r.category,
      salePriceMinor: Number(r.sale_price_minor),
      available: Number(r.available),
      store: {
        slug: r.slug,
        name: r.shop_name,
        city: r.city,
        district: r.district,
        pickupEnabled: r.pickup_enabled,
        deliveryEnabled: r.delivery_enabled,
        ...(detail
          ? { phone: r.phone, address: r.address, hours: r.hours }
          : {}),
      },
    };
  }
  private from =
    ' FROM variants v JOIN shops s ON s.id=v.shop_id JOIN product_publications p ON p.variant_id=v.id AND p.shop_id=s.id LEFT JOIN stock_balances b ON b.shop_id=v.shop_id AND b.variant_id=v.id';
  private select =
    `SELECT v.id,v.size,v.color,(p.photo_data IS NOT NULL) has_photo,cardinality(p.photo_album) photo_count,p.name,p.description,p.category,v.sale_price_minor,COALESCE(b.physical,0)-COALESCE(b.reserved,0) available,s.slug,s.name shop_name,s.city,s.phone,s.address,s.hours,s.district,s.pickup_enabled,s.delivery_enabled` +
    this.from;
  async products(query: PublicQuery) {
    const { q, page, pageSize, store, category, inStock, sort } = query;
    if (store) await this.store(store);
    const where = `s.published AND v.published AND (p.name ILIKE $1 OR s.name ILIKE $1 OR v.barcode ILIKE $1) AND ($2='' OR s.slug=$2) AND ($3='' OR p.category=$3) AND ($4=false OR COALESCE(b.physical,0)-COALESCE(b.reserved,0)>0) AND ($5='' OR s.city=$5) AND v.sale_price_minor BETWEEN $6 AND $7`;
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new BadRequestException('Invalid price range');
    const params = [
      escaped(q),
      store,
      category,
      inStock === 'true',
      query.city || '',
      query.minPrice ?? 0,
      query.maxPrice ?? Number.MAX_SAFE_INTEGER,
    ];
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
        ' p.name,v.id LIMIT $8 OFFSET $9',
      [...params, pageSize, (page - 1) * pageSize],
    );
    const [count] = await this.db.query(
      'SELECT count(*)::int total' + this.from + ' WHERE ' + where,
      params,
    );
    const cats = await this.db.query(
      "SELECT DISTINCT p.category FROM product_publications p JOIN variants v ON v.id=p.variant_id JOIN shops s ON s.id=p.shop_id WHERE s.published AND v.published AND p.category<>'' AND ($1='' OR s.slug=$1) ORDER BY p.category",
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
