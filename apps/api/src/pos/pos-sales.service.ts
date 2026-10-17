import { ForbiddenException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { IdempotencyService } from '../common/idempotency.service';
import { SalesService, SaleLine } from './sales.service';
import { ShiftsService } from './shifts.service';
import { PaymentMethod } from './pos.types';
@Injectable()
export class PosSalesService {
  constructor(
    private readonly ops: IdempotencyService,
    private readonly sales: SalesService,
    private readonly shifts: ShiftsService,
  ) {}
  async sell(
    shopId: string,
    actorId: string,
    key: string,
    shiftId: string,
    method: PaymentMethod,
    lines: SaleLine[],
  ) {
    const normalized = this.sales.normalize(lines);
    shiftId = shiftId.toLowerCase();
    return this.ops.execute(
      shopId,
      key,
      { kind: 'pos-sale', actorId, shiftId, method, lines: normalized },
      (tx) =>
        this.postInTransaction(
          tx,
          shopId,
          actorId,
          shiftId,
          method,
          normalized,
        ),
    );
  }
  // agreedPrice is internal only: the caller holds the reserved order row lock.
  async postInTransaction(
    tx: EntityManager,
    shopId: string,
    actorId: string,
    shiftId: string,
    method: PaymentMethod,
    normalized: SaleLine[],
    agreedPrice = false,
  ) {
    await this.shifts.lockOpen(tx, shopId, shiftId, actorId);
    const [member] = await tx.query(
      'SELECT role FROM memberships WHERE shop_id=$1 AND user_id=$2',
      [shopId, actorId],
    );
    if (member?.role === 'cashier') {
      for (const line of normalized) {
        if (line.discountMinor && line.discountMinor > 0) {
          const [vRow] = await tx.query(
            'SELECT sale_price_minor FROM variants WHERE shop_id=$1 AND id=$2',
            [shopId, line.variantId],
          );
          const base = Number(vRow?.sale_price_minor || 0);
          if (line.discountMinor > Math.floor(base * 0.2)) {
            throw new ForbiddenException(
              'Cashier discount limit exceeded (max 20%)',
            );
          }
        }
      }
    }
    const sale = await this.sales.postInTransaction(
      tx,
      shopId,
      actorId,
      normalized,
      agreedPrice,
    );
    await tx.query(
      'INSERT INTO pos_sales(shop_id,document_id,shift_id) VALUES($1,$2,$3)',
      [shopId, sale.id, shiftId],
    );
    await tx.query(
      "INSERT INTO payment_records(id,shop_id,document_id,shift_id,actor_id,kind,method,amount_minor) VALUES($1,$2,$3,$4,$5,'sale',$6,$7)",
      [
        randomUUID(),
        shopId,
        sale.id,
        shiftId,
        actorId,
        method,
        sale.totalMinor,
      ],
    );
    await this.shifts.lockOpen(tx, shopId, shiftId, actorId);
    return { ...sale, shiftId, method };
  }
}
