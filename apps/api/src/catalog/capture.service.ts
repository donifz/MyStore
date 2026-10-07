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
export type CaptureInput = VariantInput & {
  unitCostMinor: number;
  quantity: number;
  photoDataUrl: string;
  category: string;
  description: string;
};
@Injectable()
export class CaptureService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly ops: IdempotencyService,
    private readonly receiving: ReceivingService,
    private readonly variants: VariantsService,
  ) {}
  async capture(shop: string, actor: string, key: string, input: CaptureInput) {
    const photo = await normalizeProductPhoto(input.photoDataUrl);
    const { photoDataUrl, ...fields } = input;
    const payload = {
      ...fields,
      name: fields.name.trim(),
      category: fields.category.trim(),
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
            'INSERT INTO variants(id,shop_id,name,barcode,sale_price_minor,category,description,photo_data) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
            [
              id,
              shop,
              payload.name,
              barcode,
              input.salePriceMinor,
              payload.category,
              payload.description,
              photo,
            ],
          );
        } catch (e: any) {
          if (e.code === '23505')
            throw new ConflictException('Barcode already exists');
          throw e;
        }
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
          ...this.variants.dto(row),
          receivingId: receiving.id,
          quantity: input.quantity,
        };
      },
    );
  }
  async photo(shop: string | null, id: string, slug?: string) {
    const [r] = await this.db.query(
      'SELECT v.photo_data FROM variants v JOIN shops s ON s.id=v.shop_id WHERE v.id=$1 AND ($2::uuid IS NULL OR v.shop_id=$2) AND ($3::text IS NULL OR (s.slug=$3 AND s.published AND v.published))',
      [id, shop, slug ?? null],
    );
    if (!r?.photo_data) throw new NotFoundException();
    return r.photo_data as Buffer;
  }
}
