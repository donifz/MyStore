import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { IdempotencyService } from '../common/idempotency.service';
import { minor, quantity, safeMoney } from '../common/money';
import { StockService } from './stock.service';
export type ReceiveLine = {
  variantId: string;
  quantity: number;
  unitCostMinor: number;
};
export type ReceiptResult = {
  id: string;
  kind: 'receiving';
  totalMinor: number;
};
@Injectable()
export class ReceivingService {
  constructor(
    private readonly operations: IdempotencyService,
    private readonly stock: StockService,
  ) {}
  async receive(
    shopId: string,
    actorId: string,
    key: string,
    lines: ReceiveLine[],
  ): Promise<ReceiptResult> {
    if (!lines.length)
      throw new BadRequestException('At least one receiving line required');
    const normalized = lines
      .map((l) => ({
        variantId: l.variantId.toLowerCase(),
        quantity: quantity(l.quantity),
        unitCostMinor: safeMoney(minor(l.unitCostMinor)),
      }))
      .sort((a, b) => a.variantId.localeCompare(b.variantId));
    return this.operations.execute(
      shopId,
      key,
      { kind: 'receiving', lines: normalized },
      (tx) => this.postInTransaction(tx, shopId, actorId, normalized),
    );
  }
  async postInTransaction(
    tx: EntityManager,
    shopId: string,
    actorId: string,
    normalized: ReceiveLine[],
  ): Promise<ReceiptResult> {
    const total = safeMoney(
      normalized.reduce(
        (sum, l) => sum + BigInt(l.quantity) * BigInt(l.unitCostMinor),
        0n,
      ),
    );
    const rows = await this.stock.lock(
      tx,
      shopId,
      normalized.map((l) => l.variantId),
    );
    const id = randomUUID();
    await tx.query(
      "INSERT INTO stock_documents(id,shop_id,actor_id,kind,total_minor)VALUES($1,$2,$3,'receiving',$4)",
      [id, shopId, actorId, total],
    );
    for (const l of normalized) {
      const row = rows.get(l.variantId)!;
      const physical = Number(row.physical) + l.quantity;
      if (physical > 1000000000)
        throw new BadRequestException('Stock quantity exceeds limit');
      const value = safeMoney(
        BigInt(row.stock_value_minor) +
          BigInt(l.quantity) * BigInt(l.unitCostMinor),
      );
      await tx.query(
        'UPDATE stock_balances SET physical=$3,stock_value_minor=$4 WHERE shop_id=$1 AND variant_id=$2',
        [shopId, l.variantId, physical, value],
      );
      await tx.query(
        'INSERT INTO stock_movements(id,shop_id,document_id,variant_id,quantity,value_minor)VALUES($1,$2,$3,$4,$5,$6)',
        [
          randomUUID(),
          shopId,
          id,
          l.variantId,
          l.quantity,
          safeMoney(BigInt(l.quantity) * BigInt(l.unitCostMinor)),
        ],
      );
    }
    return { id, kind: 'receiving', totalMinor: total };
  }
}
