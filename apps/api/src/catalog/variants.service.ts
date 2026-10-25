import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID, randomBytes } from 'node:crypto';
import { DATABASE } from '../database';
import { CategoriesService } from './categories.service';
import { normalizeProductPhoto } from './product-photo';
import { stageProduct } from '../platform/product-publication';
import { IdempotencyService } from '../common/idempotency.service';
export type VariantInput = {
  name: string;
  barcode?: string;
  size?: string;
  color?: string;
  parentId?: string;
  salePriceMinor: number;
  category?: string;
  subcategory?: string;
  description?: string;
  photoDataUrl?: string;
  photoDataUrls?: string[];
};
export type Variant = {
  sku: string;
  size: string;
  color: string;
  archived: boolean;
  parentId?: string | null;
  photoUrl?: string;
  photoUrls?: string[];
  description: string;
  category: string;
  subcategory: string;
  published: boolean;
  publicationStatus?: string;
  rejectionReason?: string;
  id: string;
  name: string;
  barcode: string;
  salePriceMinor: number;
};
@Injectable()
export class VariantsService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly categories: CategoriesService,
    private readonly operations: IdempotencyService,
  ) {}
  dto(row: any): Variant {
    return {
      id: row.id,
      sku: row.sku,
      size: row.size ?? '',
      color: row.color ?? '',
      archived: Boolean(row.archived),
      parentId: row.parent_id ?? null,
      ...(row.has_photo || row.photo_data
        ? { photoUrl: `/api/shops/${row.shop_id}/variants/${row.id}/photo` }
        : {}),
      ...(row.photo_count !== undefined
        ? {
            photoUrls: Array.from(
              { length: Math.min(Number(row.photo_count), 8) },
              (_, index) =>
                `/api/shops/${row.shop_id}/variants/${row.id}/photo?index=${index}`,
            ),
          }
        : {}),
      name: row.name,
      barcode: row.barcode,
      salePriceMinor: Number(row.sale_price_minor),
      description: row.description,
      category: row.category,
      subcategory: row.subcategory ?? '',
      published: row.published,
      ...(row.publication_status
        ? { publicationStatus: row.publication_status }
        : {}),
      ...(row.rejection_reason
        ? { rejectionReason: row.rejection_reason }
        : {}),
    };
  }
  async list(
    shopId: string,
    q: string,
    page: number,
    pageSize: number,
    showCost: boolean,
    archived = false,
  ) {
    const pattern = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
    const filter =
      'v.shop_id=$1 AND v.archived=$2 AND (v.name ILIKE $3 OR v.barcode ILIKE $3 OR v.sku ILIKE $3)';
    const [count] = await this.db.query(
      'SELECT count(*) FROM variants v WHERE ' + filter,
      [shopId, archived, pattern],
    );
    const rows = await this.db.query(
      'SELECT v.id,v.sku,v.name,v.barcode,v.size,v.color,v.archived,v.parent_id,v.sale_price_minor,COALESCE(b.physical,0) physical,COALESCE(b.reserved,0) reserved,COALESCE(b.stock_value_minor,0) stock_value_minor FROM variants v LEFT JOIN stock_balances b ON b.shop_id=v.shop_id AND b.variant_id=v.id WHERE ' +
        filter +
        ' ORDER BY v.name,v.id LIMIT $4 OFFSET $5',
      [shopId, archived, pattern, pageSize, (page - 1) * pageSize],
    );
    return {
      items: rows.map((r: any) => ({
        id: r.id,
        sku: r.sku,
        size: r.size,
        color: r.color,
        archived: Boolean(r.archived),
        parentId: r.parent_id ?? null,
        name: r.name,
        barcode: r.barcode,
        salePriceMinor: Number(r.sale_price_minor),
        physical: Number(r.physical),
        reserved: Number(r.reserved),
        available: Number(r.physical) - Number(r.reserved),
        ...(showCost ? { stockValueMinor: Number(r.stock_value_minor) } : {}),
      })),
      total: Number(count.count),
      page,
      pageSize,
    };
  }
  async createVariant(
    shopId: string,
    input: VariantInput,
    actor: string,
    key: string,
  ): Promise<Variant> {
    return this.operations.execute(
      shopId,
      key,
      { kind: 'variant', ...input },
      () => this.createVariantUnsafe(shopId, input, actor),
    );
  }
  private async createVariantUnsafe(
    shopId: string,
    input: VariantInput,
    actor: string,
  ): Promise<Variant> {
    await this.categories.assertSelection(
      shopId,
      input.category ?? '',
      input.subcategory ?? '',
    );
    if (input.parentId) {
      const [parent] = await this.db.query(
        'SELECT id, archived FROM variants WHERE shop_id=$1 AND id=$2',
        [shopId, input.parentId],
      );
      if (!parent) throw new NotFoundException('Parent product not found');
      if (parent.archived)
        throw new ConflictException('Cannot add variant to archived product');
    }
    const sources =
      input.photoDataUrls ?? (input.photoDataUrl ? [input.photoDataUrl] : []);
    if (sources.length > 8) throw new ConflictException('Maximum eight photos');
    const album = await Promise.all(sources.map(normalizeProductPhoto));
    const photo = album[0] ?? null;
    const barcode =
      input.barcode ?? `MS${randomBytes(12).toString('hex').toUpperCase()}`;
    try {
      const row = await this.db.transaction(async (tx) => {
        const [created] = await tx.query(
          'INSERT INTO variants(id,shop_id,name,barcode,sale_price_minor,category,subcategory,description,photo_data,size,color,photo_album,parent_id)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)RETURNING *',
          [
            randomUUID(),
            shopId,
            input.name.trim(),
            barcode,
            input.salePriceMinor,
            input.category?.trim() ?? '',
            input.subcategory?.trim() ?? '',
            input.description?.trim() ?? '',
            photo,
            input.size?.trim() ?? '',
            input.color?.trim() ?? '',
            album,
            input.parentId ?? null,
          ],
        );
        await stageProduct(tx, created, actor);
        return created;
      });
      return this.dto({ ...row, publication_status: 'pending' });
    } catch (e: any) {
      if (e.code === '23505')
        throw new ConflictException('Barcode already exists');
      throw e;
    }
  }
  async archiveVariant(shopId: string, id: string, actor: string) {
    return this.db.transaction(async (tx) => {
      const [variant] = await tx.query(
        'SELECT * FROM variants WHERE shop_id=$1 AND id=$2 FOR UPDATE',
        [shopId, id],
      );
      if (!variant) throw new NotFoundException('Variant not found');
      if (variant.archived) return this.dto(variant);
      const [balance] = await tx.query(
        'SELECT COALESCE(reserved, 0)::int AS reserved FROM stock_balances WHERE shop_id=$1 AND variant_id=$2',
        [shopId, id],
      );
      if (balance && balance.reserved > 0) {
        throw new ConflictException(
          'Cannot archive variant with active reservations',
        );
      }
      const [[updated]] = await tx.query(
        'UPDATE variants SET archived=true WHERE shop_id=$1 AND id=$2 RETURNING *',
        [shopId, id],
      );
      await tx.query(
        `INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
         VALUES($1,$2,'archived','variant',$3,jsonb_build_object('name',$4::text,'barcode',$5::text,'sku',$6::text))`,
        [shopId, actor, id, variant.name, variant.barcode, variant.sku],
      );
      return this.dto(updated);
    });
  }
  async unarchiveVariant(shopId: string, id: string, actor: string) {
    return this.db.transaction(async (tx) => {
      const [variant] = await tx.query(
        'SELECT * FROM variants WHERE shop_id=$1 AND id=$2 FOR UPDATE',
        [shopId, id],
      );
      if (!variant) throw new NotFoundException('Variant not found');
      if (!variant.archived) return this.dto(variant);
      const [[updated]] = await tx.query(
        'UPDATE variants SET archived=false WHERE shop_id=$1 AND id=$2 RETURNING *',
        [shopId, id],
      );
      await tx.query(
        `INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
         VALUES($1,$2,'unarchived','variant',$3,jsonb_build_object('name',$4::text,'barcode',$5::text,'sku',$6::text))`,
        [shopId, actor, id, variant.name, variant.barcode, variant.sku],
      );
      return this.dto(updated);
    });
  }
  async getVariantsGroup(shopId: string, id: string) {
    const [v] = await this.db.query(
      'SELECT id, parent_id FROM variants WHERE shop_id=$1 AND id=$2',
      [shopId, id],
    );
    if (!v) throw new NotFoundException('Variant not found');
    const rootId = v.parent_id || v.id;
    const rows = await this.db.query(
      `SELECT v.id,v.sku,v.name,v.barcode,v.size,v.color,v.archived,v.parent_id,v.sale_price_minor,
              COALESCE(b.physical,0) physical,COALESCE(b.reserved,0) reserved,
              COALESCE(b.physical,0)-COALESCE(b.reserved,0) available
       FROM variants v
       LEFT JOIN stock_balances b ON b.shop_id=v.shop_id AND b.variant_id=v.id
       WHERE v.shop_id=$1 AND (v.id=$2 OR v.parent_id=$2)
       ORDER BY v.created_at ASC, v.id ASC`,
      [shopId, rootId],
    );
    return rows.map((r: any) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      barcode: r.barcode,
      size: r.size,
      color: r.color,
      archived: Boolean(r.archived),
      parentId: r.parent_id ?? null,
      salePriceMinor: Number(r.sale_price_minor),
      available: Number(r.available),
    }));
  }
  async replacePhotoAlbum(
    shopId: string,
    id: string,
    sources: string[],
    actor: string,
  ) {
    const album = await Promise.all(sources.map(normalizeProductPhoto));
    return this.db.transaction(async (tx) => {
      const [before] = await tx.query(
        'SELECT * FROM variants WHERE shop_id=$1 AND id=$2 FOR UPDATE',
        [shopId, id],
      );
      if (!before) throw new NotFoundException();
      const [[row]] = await tx.query(
        'UPDATE variants SET photo_data=$3,photo_album=$4 WHERE shop_id=$1 AND id=$2 RETURNING *',
        [shopId, id, album[0] ?? null, album],
      );
      await stageProduct(tx, row, actor);
      return this.dto({ ...row, publication_status: 'pending' });
    });
  }
  async findByBarcode(
    shopId: string,
    barcode: string,
  ): Promise<Variant | null> {
    const [row] = await this.db.query(
      'SELECT id,shop_id,sku,name,barcode,sale_price_minor,description,category,subcategory,published,(photo_data IS NOT NULL) has_photo FROM variants WHERE shop_id=$1 AND barcode=$2',
      [shopId, barcode],
    );
    return row ? this.dto(row) : null;
  }
  async updateVariant(
    shopId: string,
    id: string,
    input: {
      name: string;
      salePriceMinor: number;
      description: string;
      category: string;
      subcategory?: string;
      published: boolean;
    },
    actor: string,
  ) {
    await this.categories.assertSelection(
      shopId,
      input.category,
      input.subcategory ?? '',
    );
    return this.db.transaction(async (tx) => {
      const [before] = await tx.query(
        'SELECT * FROM variants WHERE shop_id=$1 AND id=$2 FOR UPDATE',
        [shopId, id],
      );
      if (!before) throw new NotFoundException();
      const [[row]] = await tx.query(
        'UPDATE variants SET name=$3,sale_price_minor=$4,description=$5,category=$6,subcategory=$7,published=$8 WHERE shop_id=$1 AND id=$2 RETURNING *',
        [
          shopId,
          id,
          input.name.trim(),
          input.salePriceMinor,
          input.description.trim(),
          input.category.trim(),
          (input.subcategory ?? '').trim(),
          input.published,
        ],
      );
      const changed = ['name', 'description', 'category', 'subcategory'].some(
        (k) => before[k] !== row[k],
      );
      if (changed) await stageProduct(tx, row, actor);
      if (
        before.sale_price_minor !== row.sale_price_minor ||
        before.published !== row.published
      )
        await tx.query(
          `INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
           VALUES($1,$2,'updated','variant',$3,
             jsonb_build_object('priceBefore',$4::bigint,'priceAfter',$5::bigint,'publishedBefore',$6::boolean,'publishedAfter',$7::boolean))`,
          [
            shopId,
            actor,
            id,
            before.sale_price_minor,
            row.sale_price_minor,
            before.published,
            row.published,
          ],
        );
      const [pending] = await tx.query(
        "SELECT 1 FROM product_publication_revisions WHERE variant_id=$1 AND status='pending'",
        [id],
      );
      const [approved] = await tx.query(
        'SELECT 1 FROM product_publications WHERE variant_id=$1',
        [id],
      );
      return this.dto({
        ...row,
        publication_status: pending
          ? 'pending'
          : approved
            ? 'approved'
            : 'unpublished',
      });
    });
  }
  async getById(shopId: string, id: string) {
    const [row] = await this.db.query(
      "SELECT v.id,v.shop_id,v.sku,v.name,v.barcode,v.size,v.color,v.archived,v.parent_id,v.sale_price_minor,v.description,v.category,v.subcategory,v.published,(v.photo_data IS NOT NULL) has_photo,cardinality(v.photo_album) photo_count,CASE WHEN EXISTS(SELECT 1 FROM product_publication_revisions r WHERE r.variant_id=v.id AND r.status='pending') THEN 'pending' WHEN EXISTS(SELECT 1 FROM product_publications p WHERE p.variant_id=v.id) THEN 'approved' ELSE 'unpublished' END publication_status,(SELECT reason FROM product_publication_revisions r WHERE r.variant_id=v.id AND r.status='rejected' AND r.decided_by IS NOT NULL ORDER BY r.decided_at DESC LIMIT 1) rejection_reason FROM variants v WHERE v.shop_id=$1 AND v.id=$2",
      [shopId, id],
    );
    if (!row) throw new NotFoundException();
    return this.dto(row);
  }
}
