import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
import {
  businessDeadline,
  formatBusinessSchedule,
  validateBusinessSchedule,
  validateTimeZone,
} from '../orders/business-hours';
const profileColumns =
  'name,slug,storefront_theme AS \"theme\",description,city,address,phone,hours,published,district,pickup_enabled AS \"pickupEnabled\",delivery_enabled AS \"deliveryEnabled\",time_zone AS \"timeZone\",business_schedule AS \"businessSchedule\"';
export type ProfileInput = {
  slug?: string;
  theme?: string;
  timeZone?: string;
  businessSchedule?: unknown;
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
const reservedSlugs = new Set([
  'api',
  'admin',
  'auth',
  'login',
  'public',
  'shop',
  'shops',
  'products',
]);
const storefrontThemes = new Set(['classic', 'festive', 'minimal', 'nature']);
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
  private profileDto(row: any) {
    const from = new Date();
    const expiresAt = row.businessSchedule
      ? businessDeadline(from, row.businessSchedule, row.timeZone)
      : new Date(from.getTime() + 30 * 60_000);
    return {
      ...row,
      reservationPolicy: row.businessSchedule
        ? 'business-hours'
        : 'legacy-30-minutes',
      confirmationPreview: {
        from: from.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    };
  }
  async profile(shopId: string) {
    const [r] = await this.db.query(
      'SELECT ' + profileColumns + ' FROM shops WHERE id=$1',
      [shopId],
    );
    if (!r) throw new NotFoundException();
    return this.profileDto(r);
  }
  async updateProfile(shopId: string, input: ProfileInput, actor: string) {
    if (
      input.published &&
      (!input.city.trim() ||
        !/^\+?[\d\s()-]{7,30}$/.test(input.phone.trim()) ||
        !/^\d{7,15}$/.test(input.phone.replace(/\D/g, '')))
    )
      throw new BadRequestException('City and phone required for publication');
    return this.db.transaction(async (tx) => {
      const [current] = await tx.query(
        'SELECT * FROM shops WHERE id=$1 FOR UPDATE',
        [shopId],
      );
      if (!current) throw new NotFoundException();
      if (
        !(input.pickupEnabled ?? current.pickup_enabled) &&
        !(input.deliveryEnabled ?? current.delivery_enabled)
      )
        throw new BadRequestException('Enable at least one fulfillment method');
      const timeZone =
        input.timeZone === undefined ? current.time_zone : input.timeZone;
      let schedule;
      try {
        validateTimeZone(timeZone);
        const value =
          input.businessSchedule === undefined
            ? current.business_schedule
            : input.businessSchedule;
        schedule =
          value === null ? null : validateBusinessSchedule(value, timeZone);
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }
      const hours = schedule
        ? formatBusinessSchedule(schedule)
        : input.hours.trim();
      const requestedSlug = input.slug?.trim().toLowerCase();
      const requestedTheme = input.theme?.trim().toLowerCase();
      if (requestedTheme !== undefined && !storefrontThemes.has(requestedTheme))
        throw new BadRequestException('Unknown storefront theme');
      if (
        requestedSlug !== undefined &&
        (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(requestedSlug) ||
          reservedSlugs.has(requestedSlug))
      )
        throw new BadRequestException('Invalid or reserved shop address');
      if (requestedSlug !== undefined && requestedSlug !== current.slug) {
        const [taken] = await tx.query(
          'SELECT 1 FROM shops WHERE slug=$1 AND id<>$2 UNION ALL SELECT 1 FROM shop_slug_history WHERE slug=$1 LIMIT 1',
          [requestedSlug, shopId],
        );
        if (taken)
          throw new BadRequestException('Shop address is already taken');
        await tx.query(
          'INSERT INTO shop_slug_history(shop_id,slug,current_slug) VALUES($1,$2,$3)',
          [shopId, current.slug, requestedSlug],
        );
        await tx.query(
          'UPDATE shop_slug_history SET current_slug=$2 WHERE shop_id=$1',
          [shopId, requestedSlug],
        );
      }
      const [[row]] = await tx.query(
        'UPDATE shops SET slug=COALESCE($2,slug),storefront_theme=COALESCE($3,storefront_theme),description=$4,city=$5,address=$6,phone=$7,hours=$8,published=$9,district=COALESCE($10,district),pickup_enabled=COALESCE($11,pickup_enabled),delivery_enabled=COALESCE($12,delivery_enabled),time_zone=$13,business_schedule=$14 WHERE id=$1 RETURNING ' +
          profileColumns,
        [
          shopId,
          requestedSlug ?? null,
          requestedTheme ?? null,
          input.description.trim(),
          input.city.trim(),
          input.address.trim(),
          input.phone.trim(),
          hours,
          input.published,
          input.district?.trim() ?? null,
          input.pickupEnabled ?? null,
          input.deliveryEnabled ?? null,
          timeZone,
          schedule === null ? null : JSON.stringify(schedule),
        ],
      );
      if (
        current.time_zone !== timeZone ||
        JSON.stringify(current.business_schedule) !== JSON.stringify(schedule)
      ) {
        await tx.query(
          `INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
          VALUES($1,$2,'updated','shop_schedule',$1,$3)`,
          [
            shopId,
            actor,
            JSON.stringify({
              before: {
                timeZone: current.time_zone,
                businessSchedule: current.business_schedule,
              },
              after: { timeZone, businessSchedule: schedule },
            }),
          ],
        );
      }
      return this.profileDto(row);
    });
  }
  async filters() {
    const locations = await this.db.query(
      "SELECT DISTINCT city,district FROM shops WHERE published AND (NOT marketplace_blocked) AND city<>'' ORDER BY city,district",
    );
    const categories = await this.db.query(
      "SELECT DISTINCT p.category FROM product_publications p JOIN variants v ON v.id=p.variant_id JOIN shops s ON s.id=v.shop_id WHERE s.published AND (NOT s.marketplace_blocked) AND v.published AND p.category<>'' ORDER BY p.category",
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
    const where = `s.published AND (NOT s.marketplace_blocked) AND (s.name ILIKE $1 OR s.city ILIKE $1) AND ($2='' OR s.city=$2) AND ($3='' OR s.district=$3) AND ($4='' OR EXISTS (SELECT 1 FROM variants v JOIN product_publications p ON p.variant_id=v.id WHERE v.shop_id=s.id AND v.published AND p.category=$4))`;
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
      'SELECT s.name,s.slug,s.storefront_theme AS "theme",s.description,s.city,s.address,s.phone,s.hours,s.district,s.pickup_enabled AS "pickupEnabled",s.delivery_enabled AS "deliveryEnabled",(h.slug IS NOT NULL) AS "redirectFrom" FROM shops s LEFT JOIN shop_slug_history h ON h.shop_id=s.id AND h.slug=$1 WHERE (s.slug=$1 OR h.slug=$1) AND s.published AND (NOT s.marketplace_blocked)',
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
      sku: r.sku ?? '',
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
    `SELECT v.id,v.size,v.color,v.sku,v.parent_id,(p.photo_data IS NOT NULL) has_photo,cardinality(p.photo_album) photo_count,p.name,p.description,p.category,v.sale_price_minor,COALESCE(b.physical,0)-COALESCE(b.reserved,0) available,s.slug,s.name shop_name,s.city,s.phone,s.address,s.hours,s.district,s.pickup_enabled,s.delivery_enabled` +
    this.from;
  private async canonicalSlug(slug: string) {
    const [row] = await this.db.query(
      'SELECT s.slug FROM shops s LEFT JOIN shop_slug_history h ON h.shop_id=s.id AND h.slug=$1 WHERE (s.slug=$1 OR h.slug=$1) AND s.published AND (NOT s.marketplace_blocked)',
      [slug],
    );
    if (!row) throw new NotFoundException();
    return row.slug as string;
  }
  async products(query: PublicQuery) {
    const { q, page, pageSize, store, category, inStock, sort } = query;
    const canonicalStore = store ? await this.canonicalSlug(store) : '';
    const where = `s.published AND (NOT s.marketplace_blocked) AND v.published AND NOT v.archived AND (p.name ILIKE $1 OR s.name ILIKE $1 OR v.barcode ILIKE $1 OR v.sku ILIKE $1) AND ($2='' OR s.slug=$2) AND ($3='' OR p.category=$3) AND ($4=false OR COALESCE(b.physical,0)-COALESCE(b.reserved,0)>0) AND ($5='' OR s.city=$5) AND v.sale_price_minor BETWEEN $6 AND $7`;
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new BadRequestException('Invalid price range');
    const params = [
      escaped(q),
      canonicalStore,
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
          ? 'v.sale_price_minor ASC, p.name ASC, v.id ASC'
          : sort === 'price-desc'
            ? 'v.sale_price_minor DESC, p.name ASC, v.id ASC'
            : sort === 'newest'
              ? 'p.approved_at DESC, v.id ASC'
              : 'p.name ASC, v.id ASC') +
        ' LIMIT $8 OFFSET $9',
      [...params, pageSize, (page - 1) * pageSize],
    );
    const [count] = await this.db.query(
      'SELECT count(*)::int total' + this.from + ' WHERE ' + where,
      params,
    );
    const cats = await this.db.query(
      "SELECT DISTINCT p.category FROM product_publications p JOIN variants v ON v.id=p.variant_id JOIN shops s ON s.id=p.shop_id WHERE s.published AND (NOT s.marketplace_blocked) AND v.published AND NOT v.archived AND p.category<>'' AND ($1='' OR s.slug=$1) ORDER BY p.category",
      [canonicalStore],
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
    const canonicalStore = await this.canonicalSlug(slug);
    const [r] = await this.db.query(
      this.select +
        ' WHERE s.published AND (NOT s.marketplace_blocked) AND v.published AND NOT v.archived AND s.slug=$1 AND v.id=$2',
      [canonicalStore, id],
    );
    if (!r) throw new NotFoundException();
    const rootId = r.parent_id || r.id;
    const groupRows = await this.db.query(
      `SELECT v.id, v.name, v.size, v.color, v.sku, v.sale_price_minor,
              COALESCE(b.physical,0)-COALESCE(b.reserved,0) available
       FROM variants v
       JOIN shops s ON s.id=v.shop_id
       LEFT JOIN stock_balances b ON b.shop_id=v.shop_id AND b.variant_id=v.id
       WHERE s.slug=$1 AND v.published AND NOT v.archived AND (v.id=$2 OR v.parent_id=$2)
       ORDER BY v.created_at ASC, v.id ASC`,
      [canonicalStore, rootId],
    );
    const dto = this.productDto(r, true);
    return {
      ...dto,
      variants: groupRows.map((v: any) => ({
        id: v.id,
        name: v.name,
        size: v.size ?? '',
        color: v.color ?? '',
        sku: v.sku ?? '',
        salePriceMinor: Number(v.sale_price_minor),
        available: Number(v.available),
      })),
    };
  }
}
