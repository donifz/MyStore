import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
import { IdempotencyService } from '../common/idempotency.service';
import { safeMoney } from '../common/money';
import { StockService } from './stock.service';

const validReason = (reason: string) => {
  const clean = reason.replace(/[\x00-\x1f\x7f]/g, ' ').trim();
  if (!clean || clean.length > 500)
    throw new BadRequestException('Reason required');
  return clean;
};
const valueForRemoval = (quantity: bigint, physical: bigint, value: bigint) =>
  physical === 0n ? 0n : (2n * value * quantity + physical) / (2n * physical);

@Injectable()
export class StockOperationsService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly ops: IdempotencyService,
    private readonly stock: StockService,
  ) {}

  async count(
    shop: string,
    actor: string,
    key: string,
    input: {
      variantId: string;
      expectedQuantity: number;
      countedQuantity: number;
      unitCostMinor: number;
      reason: string;
    },
  ) {
    const reason = validReason(input.reason),
      variantId = input.variantId.toLowerCase();
    return this.ops.execute(
      shop,
      key,
      { kind: 'inventory_count', actor, ...input, variantId, reason },
      async (tx) => {
        const row = (await this.stock.lock(tx, shop, [variantId])).get(
          variantId,
        )!;
        const physical = BigInt(row.physical),
          counted = BigInt(input.countedQuantity);
        if (physical !== BigInt(input.expectedQuantity))
          throw new ConflictException('Stock changed; recount required');
        if (counted < BigInt(row.reserved))
          throw new ConflictException('Count below reserved stock');
        const delta = counted - physical;
        const value =
          delta < 0n
            ? -valueForRemoval(-delta, physical, BigInt(row.stock_value_minor))
            : delta * BigInt(input.unitCostMinor);
        const id = randomUUID();
        await tx.query(
          "INSERT INTO stock_documents(id,shop_id,actor_id,kind,total_minor) VALUES($1,$2,$3,'inventory_count',$4)",
          [id, shop, actor, safeMoney(value < 0n ? -value : value)],
        );
        await tx.query(
          'INSERT INTO inventory_adjustments(document_id,shop_id,variant_id,expected_quantity,counted_quantity,delta_quantity,delta_value_minor,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [id, shop, variantId, physical, counted, delta, value, reason],
        );
        await tx.query(
          'UPDATE stock_balances SET physical=$3,stock_value_minor=$4 WHERE shop_id=$1 AND variant_id=$2',
          [
            shop,
            variantId,
            Number(counted),
            safeMoney(BigInt(row.stock_value_minor) + value),
          ],
        );
        if (delta !== 0n)
          await tx.query(
            'INSERT INTO stock_movements(id,shop_id,document_id,variant_id,quantity,value_minor) VALUES($1,$2,$3,$4,$5,$6)',
            [randomUUID(), shop, id, variantId, Number(delta), value],
          );
        return {
          id,
          kind: 'inventory_count',
          delta: Number(delta),
          valueMinor: Number(value),
        };
      },
    );
  }

  async writeoff(
    shop: string,
    actor: string,
    key: string,
    input: { variantId: string; quantity: number; reason: string },
  ) {
    const reason = validReason(input.reason),
      variantId = input.variantId.toLowerCase();
    return this.ops.execute(
      shop,
      key,
      { kind: 'writeoff', actor, ...input, variantId, reason },
      async (tx) => {
        const row = (await this.stock.lock(tx, shop, [variantId])).get(
          variantId,
        )!;
        const physical = BigInt(row.physical),
          q = BigInt(input.quantity);
        if (q > physical - BigInt(row.reserved))
          throw new ConflictException('Reserved or insufficient stock');
        const cost = safeMoney(
          valueForRemoval(q, physical, BigInt(row.stock_value_minor)),
        );
        const id = randomUUID();
        await tx.query(
          "INSERT INTO stock_documents(id,shop_id,actor_id,kind,total_minor) VALUES($1,$2,$3,'writeoff',$4)",
          [id, shop, actor, cost],
        );
        await tx.query(
          'INSERT INTO inventory_adjustments(document_id,shop_id,variant_id,expected_quantity,counted_quantity,delta_quantity,delta_value_minor,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [id, shop, variantId, physical, physical - q, -q, -cost, reason],
        );
        await tx.query(
          'UPDATE stock_balances SET physical=physical-$3,stock_value_minor=stock_value_minor-$4 WHERE shop_id=$1 AND variant_id=$2',
          [shop, variantId, Number(q), cost],
        );
        await tx.query(
          'INSERT INTO stock_movements(id,shop_id,document_id,variant_id,quantity,value_minor) VALUES($1,$2,$3,$4,$5,$6)',
          [randomUUID(), shop, id, variantId, -Number(q), -cost],
        );
        return { id, kind: 'writeoff', quantity: Number(q), valueMinor: cost };
      },
    );
  }

  async defects(shop: string, variantId: string) {
    const [variant] = await this.db.query(
      'SELECT id FROM variants WHERE shop_id=$1 AND id=$2',
      [shop, variantId],
    );
    if (!variant) throw new NotFoundException('Variant unavailable');
    const [row] = await this.db.query(
      'SELECT quantity,value_minor FROM defective_balances WHERE shop_id=$1 AND variant_id=$2',
      [shop, variantId],
    );
    return {
      quantity: Number(row?.quantity ?? 0),
      valueMinor: Number(row?.value_minor ?? 0),
    };
  }

  async dispose(
    shop: string,
    actor: string,
    key: string,
    input: { variantId: string; quantity: number; reason: string },
  ) {
    const reason = validReason(input.reason),
      variantId = input.variantId.toLowerCase();
    return this.ops.execute(
      shop,
      key,
      { kind: 'defect_disposal', actor, ...input, variantId, reason },
      async (tx) => {
        const [variant] = await tx.query(
          'SELECT id FROM variants WHERE shop_id=$1 AND id=$2',
          [shop, variantId],
        );
        if (!variant) throw new NotFoundException('Variant unavailable');
        await tx.query(
          'INSERT INTO defective_balances(shop_id,variant_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [shop, variantId],
        );
        const [row] = await tx.query(
          'SELECT quantity,value_minor FROM defective_balances WHERE shop_id=$1 AND variant_id=$2 FOR UPDATE',
          [shop, variantId],
        );
        const physical = BigInt(row.quantity),
          q = BigInt(input.quantity);
        if (q > physical)
          throw new ConflictException('Insufficient defective stock');
        const cost = safeMoney(
          valueForRemoval(q, physical, BigInt(row.value_minor)),
        );
        const id = randomUUID();
        await tx.query(
          "INSERT INTO stock_documents(id,shop_id,actor_id,kind,total_minor) VALUES($1,$2,$3,'defect_disposal',$4)",
          [id, shop, actor, cost],
        );
        await tx.query(
          'INSERT INTO inventory_adjustments(document_id,shop_id,variant_id,expected_quantity,counted_quantity,delta_quantity,delta_value_minor,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [id, shop, variantId, physical, physical - q, -q, -cost, reason],
        );
        await tx.query(
          'UPDATE defective_balances SET quantity=quantity-$3,value_minor=value_minor-$4 WHERE shop_id=$1 AND variant_id=$2',
          [shop, variantId, Number(q), cost],
        );
        await tx.query(
          'INSERT INTO defective_movements(id,shop_id,variant_id,document_id,quantity,value_minor) VALUES($1,$2,$3,$4,$5,$6)',
          [randomUUID(), shop, variantId, -Number(q), -cost],
        );
        return {
          id,
          kind: 'defect_disposal',
          quantity: Number(q),
          valueMinor: cost,
        };
      },
    );
  }
}
