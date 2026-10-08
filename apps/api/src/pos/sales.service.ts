import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { IdempotencyService } from '../common/idempotency.service';
import { minor, quantity, safeMoney } from '../common/money';
import { StockService } from '../inventory/stock.service';
export type SaleLine = {
  variantId: string;
  quantity: number;
  expectedUnitPriceMinor: number;
};
export type SaleResult = { id: string; kind: 'sale'; totalMinor: number };
@Injectable()
export class SalesService {
  constructor(
    private readonly operations: IdempotencyService,
    private readonly stock: StockService,
  ) {}
  async sell(
    shopId: string,
    actorId: string,
    key: string,
    lines: SaleLine[],
  ): Promise<SaleResult> {
    const normalized = this.normalize(lines);
    return this.operations.execute(
      shopId,
      key,
      { kind: 'sale', lines: normalized },
      (tx) => this.postInTransaction(tx, shopId, actorId, normalized),
    );
  }
  normalize(lines: SaleLine[]): SaleLine[] {
    if (!lines.length)
      throw new BadRequestException('At least one sale line required');
    return lines
      .map((l) => ({
        variantId: l.variantId.toLowerCase(),
        quantity: quantity(l.quantity),
        expectedUnitPriceMinor: safeMoney(minor(l.expectedUnitPriceMinor)),
      }))
      .sort((a, b) => a.variantId.localeCompare(b.variantId));
  }
  async postInTransaction(
    tx: EntityManager,
    shopId: string,
    actorId: string,
    normalized: SaleLine[],
    reservedOrder = false,
  ): Promise<SaleResult> {
    const total = safeMoney(
      normalized.reduce(
        (sum, l) => sum + BigInt(l.quantity) * BigInt(l.expectedUnitPriceMinor),
        0n,
      ),
    );
    const rows = await this.stock.lock(
      tx,
      shopId,
      normalized.map((l) => l.variantId),
    );
    const id = randomUUID();
    for (const line of normalized) {
      const row = rows.get(line.variantId)!;
      if (
        !reservedOrder &&
        Number(row.sale_price_minor) !== line.expectedUnitPriceMinor
      )
        throw new ConflictException({
          message: 'Price changed',
          variantId: line.variantId,
          currentUnitPriceMinor: Number(row.sale_price_minor),
        });
      if (reservedOrder && Number(row.reserved) < line.quantity)
        throw new ConflictException('Order reservation missing');
      if (
        Number(row.physical) -
          Number(row.reserved) +
          (reservedOrder ? line.quantity : 0) <
        line.quantity
      )
        throw new ConflictException({
          message: 'Insufficient available stock',
          variantId: line.variantId,
          available: Number(row.physical) - Number(row.reserved),
        });
    }
    await tx.query(
      "INSERT INTO stock_documents(id,shop_id,actor_id,kind,total_minor)VALUES($1,$2,$3,'sale',$4)",
      [id, shopId, actorId, total],
    );
    for (const line of normalized) {
      const row = rows.get(line.variantId)!;
      const physical = BigInt(row.physical);
      const value = BigInt(row.stock_value_minor);
      const q = BigInt(line.quantity);
      const cost = (2n * value * q + physical) / (2n * physical);
      await tx.query(
        'UPDATE stock_balances SET physical=physical-$3,reserved=reserved-$5,stock_value_minor=stock_value_minor-$4 WHERE shop_id=$1 AND variant_id=$2',
        [
          shopId,
          line.variantId,
          line.quantity,
          safeMoney(cost),
          reservedOrder ? line.quantity : 0,
        ],
      );
      await tx.query(
        'INSERT INTO stock_movements(id,shop_id,document_id,variant_id,quantity,value_minor)VALUES($1,$2,$3,$4,$5,$6)',
        [
          randomUUID(),
          shopId,
          id,
          line.variantId,
          -line.quantity,
          -safeMoney(cost),
        ],
      );
      await tx.query(
        'INSERT INTO sale_lines(id,shop_id,document_id,variant_id,name,barcode,quantity,unit_price_minor,cost_minor)SELECT $1,$2,$3,id,name,barcode,$5,$6,$7 FROM variants WHERE shop_id=$2 AND id=$4',
        [
          randomUUID(),
          shopId,
          id,
          line.variantId,
          line.quantity,
          line.expectedUnitPriceMinor,
          safeMoney(cost),
        ],
      );
    }
    return { id, kind: 'sale', totalMinor: total };
  }
}
