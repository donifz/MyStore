import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { normalizeProductPhoto } from './product-photo';
import { DATABASE } from '../database';
import { IdempotencyService } from '../common/idempotency.service';
import { ReceivingService } from '../inventory/receiving.service';
import { VariantsService, VariantInput } from './variants.service';
import { CategoriesService } from './categories.service';
import { stageProduct } from '../platform/product-publication';
export type CaptureInput = VariantInput & {
  unitCostMinor: number;
  quantity: number;
  photoDataUrl: string;
  category: string;
  subcategory: string;
  description: string;
};
@Injectable()
export class CaptureService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly ops: IdempotencyService,
    private readonly receiving: ReceivingService,
    private readonly variants: VariantsService,
    private readonly categories: CategoriesService,
  ) {}
  async capture(shop: string, actor: string, key: string, input: CaptureInput) {
    await this.categories.assertSelection(
      shop,
      input.category,
      input.subcategory ?? '',
    );
    const photo = await normalizeProductPhoto(input.photoDataUrl);
    const { photoDataUrl, ...fields } = input;
    const payload = {
      ...fields,
      name: fields.name.trim(),
      category: fields.category.trim(),
      subcategory: (fields.subcategory ?? '').trim(),
      description: fields.description.trim(),
      photoHash: createHash('sha256').update(photoDataUrl).digest('hex'),
    };
    return this.ops.execute(
      shop,
      key,
      { kind: 'capture', actor, ...payload },
      async (tx) => {
        const id = randomUUID(),
          barcode =
            input.barcode ??
            `MS${randomBytes(12).toString('hex').toUpperCase()}`;
        let row: any;
        try {
          [row] = await tx.query(
            'INSERT INTO variants(id,shop_id,name,barcode,sale_price_minor,category,subcategory,description,photo_data,photo_album) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
            [
              id,
              shop,
              payload.name,
              barcode,
              input.salePriceMinor,
              payload.category,
              payload.subcategory,
              payload.description,
              photo,
              [photo],
            ],
          );
        } catch (e: any) {
          if (e.code === '23505')
            throw new ConflictException('Barcode already exists');
          throw e;
        }
        await stageProduct(tx, row, actor);
        const receiving = await this.receiving.postInTransaction(
          tx,
          shop,
          actor,
          [
            {
              variantId: id,
              quantity: input.quantity,
              unitCostMinor: input.unitCostMinor,
            },
          ],
        );
        return {
          ...this.variants.dto({ ...row, publication_status: 'pending' }),
          receivingId: receiving.id,
          quantity: input.quantity,
        };
      },
    );
  }
  async photo(shop: string | null, id: string, slug?: string, index = 0) {
    if (!Number.isInteger(index) || index < 0 || index > 7)
      throw new NotFoundException();
    const [r] = await this.db.query(
      'SELECT CASE WHEN $3::text IS NULL THEN v.photo_album[$4] ELSE p.photo_album[$4] END photo_data FROM variants v JOIN shops s ON s.id=v.shop_id LEFT JOIN product_publications p ON p.variant_id=v.id WHERE v.id=$1 AND ($2::uuid IS NULL OR v.shop_id=$2) AND ($3::text IS NULL OR (s.slug=$3 AND s.published AND v.published AND p.variant_id IS NOT NULL))',
      [id, shop, slug ?? null, index + 1],
    );
    if (!r?.photo_data) throw new NotFoundException();
    return r.photo_data as Buffer;
  }
}
