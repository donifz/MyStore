import { Injectable } from '@nestjs/common';
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
      async (tx) => {
        await this.shifts.lockOpen(tx, shopId, shiftId, actorId);
        const sale = await this.sales.postInTransaction(
          tx,
          shopId,
          actorId,
          normalized,
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
      },
    );
  }
}
