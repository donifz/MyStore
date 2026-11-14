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
import { validateBanner } from './banner';
const profileColumns = `name,slug,theme_content->'hero' AS "banner",description,city,address,phone,hours,published,district,pickup_enabled AS "pickupEnabled",delivery_enabled AS "deliveryEnabled",time_zone AS "timeZone",business_schedule AS "businessSchedule"`;
export type ProfileInput = {
  slug?: string;
  banner?: unknown;
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
  minRating?: number;
  q: string;
  page: number;
  pageSize: number;
  store: string;
  category: string;
  inStock: string;
  sort: string;
  attributes?: Record<string, string | string[]>;
};
export type ReviewInput = {
  operationKey: string;
  rating: number;
  comment?: string;
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
    const from = new Date();
    const expiresAt = row.businessSchedule
      ? businessDeadline(from, row.businessSchedule, row.timeZone)
      : new Date(from.getTime() + 30 * 60_000);
    return {
      ...row,
      banner: row.banner ?? null,
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
  async updateBanner(shopId: string, value: unknown, actor: string) {
    const banner = await validateBanner(value);
    return this.db.transaction(async (tx) => {
      const [current] = await tx.query(
        'SELECT theme_content FROM shops WHERE id=$1 FOR UPDATE',
        [shopId],
      );
      if (!current) throw new NotFoundException();
      await tx.query(
        `UPDATE shops SET theme_content=CASE
           WHEN $2::jsonb IS NULL THEN COALESCE(theme_content,'{}'::jsonb)-'hero'
           ELSE jsonb_set(COALESCE(theme_content,'{}'::jsonb),'{hero}',$2::jsonb,true)
         END WHERE id=$1`,
        [shopId, banner ? JSON.stringify(banner) : null],
      );
      await tx.query(
        `INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
         VALUES($1,$2,'banner_changed','shop',$1,$3)`,
        [
          shopId,
          actor,
          JSON.stringify({
            before: current.theme_content?.hero ?? null,
            after: banner,
          }),
        ],
      );
      return { banner };
    });
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
    const requestedBanner =
      input.banner === undefined
        ? undefined
        : await validateBanner(input.banner);
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
          `UPDATE shops SET slug=COALESCE($2,slug),storefront_theme='base',description=$3,city=$4,address=$5,phone=$6,hours=$7,published=$8,district=COALESCE($9,district),pickup_enabled=COALESCE($10,pickup_enabled),delivery_enabled=COALESCE($11,delivery_enabled),time_zone=$12,business_schedule=$13,theme_content=CASE WHEN $14::jsonb IS NULL THEN theme_content WHEN $14::jsonb='{}'::jsonb THEN theme_content-'hero' ELSE jsonb_set(COALESCE(theme_content,'{}'::jsonb),'{hero}',$14::jsonb,true) END,theme_starts_at=NULL,theme_ends_at=NULL WHERE id=$1 RETURNING ` +
            profileColumns,
          [
            shopId,
            requestedSlug ?? null,
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
            requestedBanner === undefined
              ? null
              : JSON.stringify(requestedBanner ?? {}),
          ],
        );
        if (requestedBanner !== undefined) {
          await tx.query(
            `INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
             VALUES($1,$2,'banner_changed','shop',$1,$3)`,
            [
              shopId,
              actor,
              JSON.stringify({
                before: current.theme_content?.hero ?? null,
                after: requestedBanner,
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
  async heroSlides() {
    try {
      return await this.db.query(
        `SELECT id, sort_order AS "sortOrder", badge, title, subtitle,
                button_text AS "buttonText", button_url AS "buttonUrl",
                image_url AS "imageUrl", mobile_image_url AS "mobileImageUrl",
                hide_overlay AS "hideOverlay", only_image AS "onlyImage",
                bg_gradient AS "bgGradient"
         FROM platform_hero_slides
         WHERE is_active = true
         ORDER BY sort_order ASC, created_at ASC`,
      );
    } catch (err: any) {
      if (err?.code === '42703') {
        const rows = await this.db.query(
          `SELECT id, sort_order AS "sortOrder", badge, title, subtitle,
                  button_text AS "buttonText", button_url AS "buttonUrl",
                  image_url AS "imageUrl",
                  bg_gradient AS "bgGradient"
           FROM platform_hero_slides
           WHERE is_active = true
           ORDER BY sort_order ASC, created_at ASC`,
        );
        return rows.map((r: any) => ({
          ...r,
          mobileImageUrl: null,
          hideOverlay: false,
          onlyImage: false,
        }));
      }
      if (err?.code === '42P01') {
        return [];
      }
      throw err;
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
      `SELECT s.name,s.slug,s.theme_content->'hero' AS banner,s.description,s.city,s.district,s.address,s.phone,s.hours,s.time_zone AS "timeZone",s.business_schedule AS "businessSchedule",s.pickup_enabled AS "pickupEnabled",s.delivery_enabled AS "deliveryEnabled",(SELECT count(*)::int FROM variants v JOIN product_publications p ON p.variant_id=v.id WHERE v.shop_id=s.id AND v.published AND NOT v.archived) AS "productCount",COALESCE((SELECT round(avg(sr.rating)::numeric,1)::float FROM storefront_reviews sr WHERE sr.shop_id=s.id AND sr.variant_id IS NULL),0) AS "ratingAverage",(SELECT count(*)::int FROM storefront_reviews sr WHERE sr.shop_id=s.id AND sr.variant_id IS NULL) AS "ratingCount",ARRAY(SELECT DISTINCT p.category FROM variants v JOIN product_publications p ON p.variant_id=v.id WHERE v.shop_id=s.id AND v.published AND NOT v.archived AND p.category<>'' ORDER BY p.category LIMIT 3) AS categories,ARRAY(SELECT '/api/public/stores/' || s.slug || '/products/' || v.id || '/photo' FROM variants v JOIN product_publications p ON p.variant_id=v.id LEFT JOIN stock_balances b ON b.shop_id=v.shop_id AND b.variant_id=v.id WHERE v.shop_id=s.id AND v.published AND NOT v.archived AND p.photo_data IS NOT NULL ORDER BY (COALESCE(b.physical,0)-COALESCE(b.reserved,0) > 0) DESC, v.created_at DESC, v.id DESC LIMIT 3) AS "previewPhotos" FROM shops s WHERE ` +
        where +
        ' ORDER BY s.name,s.slug LIMIT $5 OFFSET $6',
      [...params, pageSize, (page - 1) * pageSize],
    );
    return { items, total: count.total, page, pageSize };
  }
  async store(slug: string) {
    const [r] = await this.db.query(
      `SELECT s.name,s.slug,s.theme_content->'hero' AS banner,s.description,s.city,s.address,s.phone,s.hours,s.district,s.pickup_enabled AS "pickupEnabled",s.delivery_enabled AS "deliveryEnabled",(NOT ss.is_current) AS historical,(SELECT count(*)::int FROM variants v JOIN product_publications p ON p.variant_id=v.id WHERE v.shop_id=s.id AND v.published AND NOT v.archived) AS "productCount",COALESCE((SELECT round(avg(sr.rating)::numeric,1)::float FROM storefront_reviews sr WHERE sr.shop_id=s.id AND sr.variant_id IS NULL),0) AS "ratingAverage",(SELECT count(*)::int FROM storefront_reviews sr WHERE sr.shop_id=s.id AND sr.variant_id IS NULL) AS "ratingCount",ARRAY(SELECT DISTINCT p.category FROM variants v JOIN product_publications p ON p.variant_id=v.id WHERE v.shop_id=s.id AND v.published AND NOT v.archived AND p.category<>'' ORDER BY p.category LIMIT 8) AS categories FROM shop_slugs ss JOIN shops s ON s.id=ss.shop_id WHERE ss.slug=$1 AND s.published AND (NOT s.marketplace_blocked)`,
      [slug],
    );
    if (!r) throw new NotFoundException();
    return { ...r, banner: r.banner ?? null };
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
      attributes:
        r.attributes && typeof r.attributes === 'object' ? r.attributes : {},
      salePriceMinor: Number(r.sale_price_minor),
      available: Number(r.available),
      ...(r.rating_count !== undefined
        ? {
            ratingAverage: Number(r.rating_average || 0),
            ratingCount: Number(r.rating_count || 0),
          }
        : {}),
      store: {
        slug: r.slug,
        name: r.shop_name,
        description: r.shop_description ?? '',
        city: r.city,
        district: r.district,
        pickupEnabled: r.pickup_enabled,
        deliveryEnabled: r.delivery_enabled,
        ...(r.shop_product_count !== undefined
          ? { productCount: Number(r.shop_product_count) }
          : {}),
        ...(r.shop_rating_count !== undefined
          ? {
              ratingAverage: Number(r.shop_rating_average || 0),
              ratingCount: Number(r.shop_rating_count || 0),
            }
          : {}),
        ...(detail
          ? { phone: r.phone, address: r.address, hours: r.hours }
          : {}),
      },
    };
  }
  private from =
    ' FROM variants v JOIN shops s ON s.id=v.shop_id JOIN product_publications p ON p.variant_id=v.id AND p.shop_id=s.id LEFT JOIN stock_balances b ON b.shop_id=v.shop_id AND b.variant_id=v.id LEFT JOIN shop_categories sc ON sc.shop_id=s.id AND sc.parent_id IS NULL AND sc.name=p.category LEFT JOIN platform_categories pc ON pc.code=sc.platform_category_code';
  private select =
    `SELECT v.id,v.size,v.color,v.sku,v.parent_id,v.attributes,(p.photo_data IS NOT NULL) has_photo,cardinality(p.photo_album) photo_count,p.name,p.description,p.category,COALESCE(pc.name,p.category) AS platform_category,v.sale_price_minor,COALESCE(b.physical,0)-COALESCE(b.reserved,0) available,COALESCE((SELECT round(avg(sr.rating)::numeric,1)::float FROM storefront_reviews sr WHERE sr.variant_id=v.id),0) rating_average,(SELECT count(*)::int FROM storefront_reviews sr WHERE sr.variant_id=v.id) rating_count,s.slug,s.name shop_name,s.description shop_description,(SELECT count(*)::int FROM variants sv JOIN product_publications sp ON sp.variant_id=sv.id WHERE sv.shop_id=s.id AND sv.published AND NOT sv.archived) shop_product_count,COALESCE((SELECT round(avg(sr.rating)::numeric,1)::float FROM storefront_reviews sr WHERE sr.shop_id=s.id AND sr.variant_id IS NULL),0) shop_rating_average,(SELECT count(*)::int FROM storefront_reviews sr WHERE sr.shop_id=s.id AND sr.variant_id IS NULL) shop_rating_count,s.city,s.phone,s.address,s.hours,s.district,s.pickup_enabled,s.delivery_enabled` +
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
    const minRating =
      query.minRating && query.minRating > 0 ? query.minRating : 0;
    const where = `s.published AND (NOT s.marketplace_blocked) AND v.published AND NOT v.archived AND (p.name ILIKE $1 OR s.name ILIKE $1 OR v.barcode ILIKE $1 OR v.sku ILIKE $1) AND ($2='' OR s.slug=$2) AND ($3='' OR (CASE WHEN $2='' THEN COALESCE(pc.name,p.category) ELSE p.category END)=$3) AND ($4=false OR COALESCE(b.physical,0)-COALESCE(b.reserved,0)>0) AND ($5='' OR s.city=$5) AND v.sale_price_minor BETWEEN $6 AND $7 AND ($8=0 OR COALESCE((SELECT avg(sr.rating)::numeric FROM storefront_reviews sr WHERE sr.variant_id=v.id),0)>=$8)`;
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new BadRequestException('Invalid price range');
    const params: any[] = [
      escaped(q),
      canonicalStore,
      category,
      inStock === 'true',
      query.city || '',
      query.minPrice ?? 0,
      query.maxPrice ?? Number.MAX_SAFE_INTEGER,
      minRating,
    ];
    let extraWhere = '';
    if (query.attributes && typeof query.attributes === 'object') {
      for (const [k, v] of Object.entries(query.attributes)) {
        if (!k || v === undefined || v === '') continue;
        const vals = Array.isArray(v) ? v : [v];
        if (vals.length === 1) {
          params.push(k, vals[0]);
          extraWhere += ` AND v.attributes->>$${params.length - 1} = $${params.length}`;
        } else if (vals.length > 1) {
          params.push(k, vals);
          extraWhere += ` AND v.attributes->>$${params.length - 1} = ANY($${params.length}::text[])`;
        }
      }
    }
    const fullWhere = where + extraWhere;
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const rows = await this.db.query(
      this.select +
        ' WHERE ' +
        fullWhere +
        ' ORDER BY ' +
        (sort === 'price-asc'
          ? 'v.sale_price_minor ASC, p.name ASC, v.id ASC'
          : sort === 'price-desc'
            ? 'v.sale_price_minor DESC, p.name ASC, v.id ASC'
            : sort === 'newest'
              ? 'p.approved_at DESC, v.id ASC'
              : 'p.name ASC, v.id ASC') +
        ` LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    const [count] = await this.db.query(
      'SELECT count(*)::int total' + this.from + ' WHERE ' + fullWhere,
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
  async storeReviews(slug: string) {
    const canonicalStore = await this.canonicalSlug(slug);
    const [shop] = await this.db.query(
      'SELECT id FROM shops WHERE slug=$1 AND published AND (NOT marketplace_blocked)',
      [canonicalStore],
    );
    if (!shop) throw new NotFoundException();
    const [stats] = await this.db.query(
      'SELECT COALESCE(round(avg(rating)::numeric,1)::float,0) AS "ratingAverage", count(*)::int AS "ratingCount" FROM storefront_reviews WHERE shop_id=$1 AND variant_id IS NULL',
      [shop.id],
    );
    const items = await this.db.query(
      'SELECT id, author_name AS "authorName", rating, comment, created_at AS "createdAt" FROM storefront_reviews WHERE shop_id=$1 AND variant_id IS NULL ORDER BY created_at DESC LIMIT 30',
      [shop.id],
    );
    return {
      ratingAverage: Number(stats?.ratingAverage || 0),
      ratingCount: Number(stats?.ratingCount || 0),
      items,
    };
  }
  async createStoreReview(slug: string, buyerId: string, input: ReviewInput) {
    const canonicalStore = await this.canonicalSlug(slug);
    return this.db.transaction(async (tx) => {
      const [shop] = await tx.query(
        'SELECT id FROM shops WHERE slug=$1 AND published AND (NOT marketplace_blocked)',
        [canonicalStore],
      );
      if (!shop) throw new NotFoundException();
      return this.insertReview(tx, buyerId, shop.id, null, input);
    });
  }
  async productReviews(slug: string, id: string) {
    const canonicalStore = await this.canonicalSlug(slug);
    const [variant] = await this.db.query(
      'SELECT v.id FROM variants v JOIN shops s ON s.id=v.shop_id WHERE s.slug=$1 AND v.id=$2 AND s.published AND (NOT s.marketplace_blocked) AND v.published AND NOT v.archived',
      [canonicalStore, id],
    );
    if (!variant) throw new NotFoundException();
    const [stats] = await this.db.query(
      'SELECT COALESCE(round(avg(rating)::numeric,1)::float,0) AS "ratingAverage", count(*)::int AS "ratingCount" FROM storefront_reviews WHERE variant_id=$1',
      [id],
    );
    const items = await this.db.query(
      'SELECT id, author_name AS "authorName", rating, comment, created_at AS "createdAt" FROM storefront_reviews WHERE variant_id=$1 ORDER BY created_at DESC LIMIT 30',
      [id],
    );
    return {
      ratingAverage: Number(stats?.ratingAverage || 0),
      ratingCount: Number(stats?.ratingCount || 0),
      items,
    };
  }
  async createProductReview(
    slug: string,
    id: string,
    buyerId: string,
    input: ReviewInput,
  ) {
    const canonicalStore = await this.canonicalSlug(slug);
    return this.db.transaction(async (tx) => {
      const [variant] = await tx.query(
        'SELECT v.id, s.id AS shop_id FROM variants v JOIN shops s ON s.id=v.shop_id WHERE s.slug=$1 AND v.id=$2 AND s.published AND (NOT s.marketplace_blocked) AND v.published AND NOT v.archived',
        [canonicalStore, id],
      );
      if (!variant) throw new NotFoundException();
      return this.insertReview(tx, buyerId, variant.shop_id, id, input);
    });
  }
  // The author is always the signed-in buyer account; the client cannot
  // choose a display name. Retries with the same operation key return the
  // original review, and a buyer gets one review per shop or product.
  private async insertReview(
    tx: { query: (sql: string, params?: unknown[]) => Promise<any[]> },
    buyerId: string,
    shopId: string,
    variantId: string | null,
    input: ReviewInput,
  ) {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
      throw new BadRequestException('Выберите оценку от 1 до 5');
    const [buyer] = await tx.query(
      'SELECT display_name FROM buyer_accounts WHERE id=$1',
      [buyerId],
    );
    if (!buyer) throw new NotFoundException();
    const returning =
      'id, author_name AS "authorName", rating, comment, created_at AS "createdAt", buyer_id, shop_id, variant_id';
    let [review] = await tx.query(
      `INSERT INTO storefront_reviews(shop_id, variant_id, buyer_id, operation_key, author_name, rating, comment)
       VALUES($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING
       RETURNING ${returning}`,
      [
        shopId,
        variantId,
        buyerId,
        input.operationKey,
        String(buyer.display_name).slice(0, 120),
        input.rating,
        (input.comment || '').trim(),
      ],
    );
    if (!review) {
      [review] = await tx.query(
        `SELECT ${returning} FROM storefront_reviews WHERE operation_key=$1`,
        [input.operationKey],
      );
      if (
        !review ||
        review.buyer_id !== buyerId ||
        review.shop_id !== shopId ||
        (review.variant_id ?? null) !== variantId
      )
        throw new ConflictException('Вы уже оставили отзыв');
    }
    const [stats] = await tx.query(
      variantId
        ? 'SELECT COALESCE(round(avg(rating)::numeric,1)::float,0) AS "ratingAverage", count(*)::int AS "ratingCount" FROM storefront_reviews WHERE variant_id=$1'
        : 'SELECT COALESCE(round(avg(rating)::numeric,1)::float,0) AS "ratingAverage", count(*)::int AS "ratingCount" FROM storefront_reviews WHERE shop_id=$1 AND variant_id IS NULL',
      [variantId ?? shopId],
    );
    return {
      review: {
        id: review.id,
        authorName: review.authorName,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
      },
      ratingAverage: Number(stats?.ratingAverage || 0),
      ratingCount: Number(stats?.ratingCount || 0),
    };
  }
}
