import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DATABASE } from '../database';
export type LockedStock = {
  physical: string;
  reserved: string;
  stock_value_minor: string;
  sale_price_minor: string;
};
@Injectable()
export class StockService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}
  async getBalance(shopId: string, variantId: string) {
    const [variant] = await this.db.query(
      'SELECT id FROM variants WHERE shop_id=$1 AND id=$2',
      [shopId, variantId],
    );
    if (!variant) throw new NotFoundException();
    const [row] = await this.db.query(
      'SELECT physical,reserved,stock_value_minor FROM stock_balances WHERE shop_id=$1 AND variant_id=$2',
      [shopId, variantId],
    );
    const physical = Number(row?.physical ?? 0),
      reserved = Number(row?.reserved ?? 0);
    return {
      physical,
      reserved,
      available: physical - reserved,
      stockValueMinor: Number(row?.stock_value_minor ?? 0),
    };
  }
  async lock(
    tx: EntityManager,
    shopId: string,
    ids: string[],
  ): Promise<Map<string, LockedStock>> {
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('Duplicate variant lines');
    const result = new Map<string, LockedStock>();
    for (const id of [...ids].sort()) {
      const [variant] = await tx.query(
        'SELECT sale_price_minor FROM variants WHERE shop_id=$1 AND id=$2 FOR SHARE',
        [shopId, id],
      );
      if (!variant) throw new NotFoundException('Variant not found in shop');
      await tx.query(
        'INSERT INTO stock_balances(shop_id,variant_id)VALUES($1,$2)ON CONFLICT DO NOTHING',
        [shopId, id],
      );
      const [row] = await tx.query(
        'SELECT physical,reserved,stock_value_minor FROM stock_balances WHERE shop_id=$1 AND variant_id=$2 FOR UPDATE',
        [shopId, id],
      );
      result.set(id, { ...row, sale_price_minor: variant.sale_price_minor });
    }
    return result;
  }
}
