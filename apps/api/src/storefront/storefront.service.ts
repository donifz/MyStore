import {
  BadRequestException,
  ConflictException,
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
import {
  activePresentation,
  savedPresentation,
  validatePresentation,
} from './themes';
const profileColumns =
  'name,slug,storefront_theme AS \"theme\",theme_content AS \"themeContent\",theme_starts_at AS \"themeStartsAt\",theme_ends_at AS \"themeEndsAt\",description,city,address,phone,hours,published,district,pickup_enabled AS \"pickupEnabled\",delivery_enabled AS \"deliveryEnabled\",time_zone AS \"timeZone\",business_schedule AS \"businessSchedule\"';
export type ProfileInput = {
  slug?: string;
  presentation?: unknown;
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
  'new',
  'cart',
  'checkout',
  'seller',
  'terms',
  'privacy',
  'ui-kit',
]);
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
    const { themeContent, themeStartsAt, themeEndsAt, ...profile } = row;
    const from = new Date();
    const expiresAt = row.businessSchedule
      ? businessDeadline(from, row.businessSchedule, row.timeZone)
      : new Date(from.getTime() + 30 * 60_000);
    return {
      ...profile,
      presentation: savedPresentation(row),
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
    const requestedSlug = input.slug?.trim().toLowerCase();
    const requestedPresentation =
      input.presentation === undefined
        ? undefined
        : await validatePresentation(input.presentation);
    if (
      requestedSlug !== undefined &&
      (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(requestedSlug) ||
        reservedSlugs.has(requestedSlug))
    )
      throw new BadRequestException('Invalid or reserved shop address');
    try {
      return await this.db.transaction(async (tx) => {
        const [current] = await tx.query(
          'SELECT * FROM shops WHERE id=$1 FOR UPDATE',
          [shopId],
        );
        if (!current) throw new NotFoundException();
        if (
          !(input.pickupEnabled ?? current.pickup_enabled) &&
          !(input.deliveryEnabled ?? current.delivery_enabled)
        )
          throw new BadRequestException(
            'Enable at least one fulfillment method',
          );
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
        if (requestedSlug !== undefined && requestedSlug !== current.slug) {
          await tx.query(
            'UPDATE shop_slugs SET is_current=false WHERE shop_id=$1 AND is_current',
            [shopId],
          );
          const claimed = await tx.query(
            `INSERT INTO shop_slugs(slug,shop_id,is_current) VALUES($1,$2,true)
             ON CONFLICT (slug) DO UPDATE SET is_current=true
             WHERE shop_slugs.shop_id=excluded.shop_id
             RETURNING slug`,
            [requestedSlug, shopId],
          );
          if (!claimed.length)
            throw new ConflictException('Адрес занят, выберите другой');
          await tx.query(
            `INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
           VALUES($1,$2,'slug_changed','shop',$1,$3)`,
            [
              shopId,
              actor,
              JSON.stringify({ before: current.slug, after: requestedSlug }),
            ],
          );
        }
        const [[row]] = await tx.query(
          'UPDATE shops SET slug=COALESCE($2,slug),storefront_theme=COALESCE($3,storefront_theme),description=$4,city=$5,address=$6,phone=$7,hours=$8,published=$9,district=COALESCE($10,district),pickup_enabled=COALESCE($11,pickup_enabled),delivery_enabled=COALESCE($12,delivery_enabled),time_zone=$13,business_schedule=$14,theme_content=COALESCE($15,theme_content),theme_starts_at=CASE WHEN $3::varchar IS NULL THEN theme_starts_at ELSE $16::timestamptz END,theme_ends_at=CASE WHEN $3::varchar IS NULL THEN theme_ends_at ELSE $17::timestamptz END WHERE id=$1 RETURNING ' +
            profileColumns,
          [
            shopId,
            requestedSlug ?? null,
            requestedPresentation?.id ?? null,
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
            requestedPresentation
              ? JSON.stringify({
                  ...(requestedPresentation.hero
                    ? { hero: requestedPresentation.hero }
                    : {}),
                  ...(requestedPresentation.info
                    ? { info: requestedPresentation.info }
                    : {}),
                })
              : null,
            requestedPresentation?.startsAt ?? null,
            requestedPresentation?.endsAt ?? null,
          ],
        );
        if (requestedPresentation) {
          await tx.query(
            `INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
             VALUES($1,$2,'theme_changed','shop',$1,$3)`,
            [
              shopId,
              actor,
              JSON.stringify({
                before: savedPresentation({
                  theme: current.storefront_theme,
                  themeContent: current.theme_content,
                  themeStartsAt: current.theme_starts_at,
                  themeEndsAt: current.theme_ends_at,
                }),
                after: requestedPresentation,
              }),
            ],
          );
        }
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
    } catch (error: any) {
      if (
        requestedSlug !== undefined &&
        (error?.code === '23505' || error instanceof ConflictException)
      ) {
        await this.db.query(
          `INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
           VALUES($1,$2,'slug_change_rejected','shop',$1,$3)`,
          [shopId, actor, JSON.stringify({ requested: requestedSlug })],
        );
        throw new ConflictException('Адрес занят, выберите другой');
      }
      throw error;
    }
  }
  async filters() {
    const locations = await this.db.query(
      "SELECT DISTINCT city,district FROM shops WHERE published AND (NOT marketplace_blocked) AND city<>'' ORDER BY city,district",
    );
    const categories = await this.db.query(
      "SELECT DISTINCT COALESCE(pc.name,p.category) AS category FROM product_publications p JOIN variants v ON v.id=p.variant_id JOIN shops s ON s.id=v.shop_id LEFT JOIN shop_categories sc ON sc.shop_id=s.id AND sc.parent_id IS NULL AND sc.name=p.category LEFT JOIN platform_categories pc ON pc.code=sc.platform_category_code WHERE s.published AND (NOT s.marketplace_blocked) AND v.published AND p.category<>'' ORDER BY category",
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
      'SELECT s.name,s.slug,s.storefront_theme AS "theme",s.theme_content AS "themeContent",s.theme_starts_at AS "themeStartsAt",s.theme_ends_at AS "themeEndsAt",s.description,s.city,s.address,s.phone,s.hours,s.district,s.pickup_enabled AS "pickupEnabled",s.delivery_enabled AS "deliveryEnabled",(NOT ss.is_current) AS historical FROM shop_slugs ss JOIN shops s ON s.id=ss.shop_id WHERE ss.slug=$1 AND s.published AND (NOT s.marketplace_blocked)',
      [slug],
    );
    if (!r) throw new NotFoundException();
    const { themeContent, themeStartsAt, themeEndsAt, theme, ...store } = r;
    return { ...store, presentation: activePresentation(r) };
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
      platformCategory: r.platform_category,
      salePriceMinor: Number(r.sale_price_minor),
      available: Number(r.available),
      store: {
        slug: r.slug,
        name: r.shop_name,
        city: r.city,
        district: r.district,
        pickupEnabled: r.pickup_enabled,
        deliveryEnabled: r.delivery_enabled,
        presentation: activePresentation(r),
        ...(detail
          ? { phone: r.phone, address: r.address, hours: r.hours }
          : {}),
      },
    };
  }
  private from =
    ' FROM variants v JOIN shops s ON s.id=v.shop_id JOIN product_publications p ON p.variant_id=v.id AND p.shop_id=s.id LEFT JOIN stock_balances b ON b.shop_id=v.shop_id AND b.variant_id=v.id LEFT JOIN shop_categories sc ON sc.shop_id=s.id AND sc.parent_id IS NULL AND sc.name=p.category LEFT JOIN platform_categories pc ON pc.code=sc.platform_category_code';
  private select =
    `SELECT v.id,v.size,v.color,v.sku,v.parent_id,(p.photo_data IS NOT NULL) has_photo,cardinality(p.photo_album) photo_count,p.name,p.description,p.category,COALESCE(pc.name,p.category) AS platform_category,v.sale_price_minor,COALESCE(b.physical,0)-COALESCE(b.reserved,0) available,s.slug,s.name shop_name,s.city,s.phone,s.address,s.hours,s.district,s.pickup_enabled,s.delivery_enabled,s.storefront_theme AS theme,s.theme_content AS "themeContent",s.theme_starts_at AS "themeStartsAt",s.theme_ends_at AS "themeEndsAt"` +
    this.from;
  private async canonicalSlug(slug: string) {
    const [row] = await this.db.query(
      'SELECT s.slug FROM shop_slugs ss JOIN shops s ON s.id=ss.shop_id WHERE ss.slug=$1 AND s.published AND (NOT s.marketplace_blocked)',
      [slug],
    );
    if (!row) throw new NotFoundException();
    return row.slug as string;
  }
  async products(query: PublicQuery) {
    const { q, page, pageSize, store, category, inStock, sort } = query;
    const canonicalStore = store ? await this.canonicalSlug(store) : '';
    const where = `s.published AND (NOT s.marketplace_blocked) AND v.published AND NOT v.archived AND (p.name ILIKE $1 OR s.name ILIKE $1 OR v.barcode ILIKE $1 OR v.sku ILIKE $1) AND ($2='' OR s.slug=$2) AND ($3='' OR (CASE WHEN $2='' THEN COALESCE(pc.name,p.category) ELSE p.category END)=$3) AND ($4=false OR COALESCE(b.physical,0)-COALESCE(b.reserved,0)>0) AND ($5='' OR s.city=$5) AND v.sale_price_minor BETWEEN $6 AND $7`;
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
      "SELECT DISTINCT CASE WHEN $1='' THEN COALESCE(pc.name,p.category) ELSE p.category END AS category FROM product_publications p JOIN variants v ON v.id=p.variant_id JOIN shops s ON s.id=p.shop_id LEFT JOIN shop_categories sc ON sc.shop_id=s.id AND sc.parent_id IS NULL AND sc.name=p.category LEFT JOIN platform_categories pc ON pc.code=sc.platform_category_code WHERE s.published AND (NOT s.marketplace_blocked) AND v.published AND NOT v.archived AND p.category<>'' AND ($1='' OR s.slug=$1) ORDER BY category",
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
