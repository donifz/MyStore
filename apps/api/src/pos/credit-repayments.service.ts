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
import { minor, safeMoney } from '../common/money';
import { ShopAccessService } from '../shops/shop-access.service';
import { ShiftsService } from './shifts.service';
import { PaymentMethod } from './pos.types';

@Injectable()
export class CreditRepaymentsService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly operations: IdempotencyService,
    private readonly access: ShopAccessService,
    private readonly shifts: ShiftsService,
  ) {}

  async repay(input: {
    shopId: string;
    saleId: string;
    shiftId: string;
    actorId: string;
    key: string;
    method: PaymentMethod;
    amountMinor: number;
  }) {
    const amountMinor = safeMoney(minor(input.amountMinor));
    if (amountMinor === 0) {
      throw new BadRequestException('Сумма погашения должна быть больше нуля');
    }
    const shopId = input.shopId.toLowerCase();
    const saleId = input.saleId.toLowerCase();
    const shiftId = input.shiftId.toLowerCase();
    return this.operations.execute(
      shopId,
      input.key,
      {
        kind: 'credit-repayment',
        actorId: input.actorId,
        saleId,
        shiftId,
        method: input.method,
        amountMinor,
      },
      async (tx) => {
        // Acquiring the shift lock before credit-sale lock serializes payments
        // with shift closure without changing the existing stock ledger.
        await this.shifts.lockOpen(tx, shopId, shiftId, input.actorId);
        const [sale] = await tx.query(
          `SELECT total_minor,paid_minor,customer_id
           FROM credit_sales WHERE shop_id=$1 AND document_id=$2 FOR UPDATE`,
          [shopId, saleId],
        );
        if (!sale) throw new NotFoundException('Долговая продажа не найдена');
        const remaining = BigInt(sale.total_minor) - BigInt(sale.paid_minor);
        if (BigInt(amountMinor) > remaining) {
          throw new ConflictException('Сумма превышает остаток долга');
        }
        const [updatedRows] = await tx.query(
          `UPDATE credit_sales SET paid_minor=paid_minor+$3
           WHERE shop_id=$1 AND document_id=$2
           RETURNING paid_minor,total_minor`,
          [shopId, saleId, amountMinor],
        );
        // TypeORM returns [rows, affectedCount] for PostgreSQL UPDATE.
        const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
        if (!updated) throw new ConflictException('Не удалось обновить остаток долга');
        const [row] = await tx.query(
          `INSERT INTO credit_repayments
           (id,shop_id,sale_id,shift_id,actor_id,method,amount_minor)
           VALUES($1,$2,$3,$4,$5,$6,$7)
           RETURNING id,created_at`,
          [
            randomUUID(),
            shopId,
            saleId,
            shiftId,
            input.actorId,
            input.method,
            amountMinor,
          ],
        );
        return {
          id: row.id,
          saleId,
          shopId,
          shiftId,
          method: input.method,
          amountMinor,
          paidMinor: Number(updated.paid_minor),
          debtMinor: Number(
            BigInt(updated.total_minor) - BigInt(updated.paid_minor),
          ),
          createdAt: row.created_at.toISOString(),
        };
      },
      async (tx) => {
        await this.access.requireMembership(input.actorId, shopId, 'sell', tx);
      },
    );
  }

  async saleHistory(shopId: string, saleId: string) {
    const [sale] = await this.db.query(
      'SELECT document_id FROM credit_sales WHERE shop_id=$1 AND document_id=$2',
      [shopId, saleId],
    );
    if (!sale) throw new NotFoundException('Долговая продажа не найдена');
    const rows = await this.db.query(
      `SELECT id,shift_id AS "shiftId",actor_id AS "actorId",
       method,amount_minor AS "amountMinor",created_at AS "createdAt"
       FROM credit_repayments WHERE shop_id=$1 AND sale_id=$2
       ORDER BY created_at DESC,id DESC`,
      [shopId, saleId],
    );
    return rows.map((row: any) => ({
      ...row,
      amountMinor: Number(row.amountMinor),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async buyerHistory(buyerId: string) {
    const rows = await this.db.query(
      `SELECT r.id,r.sale_id AS "saleId",r.shop_id AS "shopId",
       s.name AS "shopName",r.method,
       r.amount_minor AS "amountMinor",r.created_at AS "createdAt"
       FROM credit_repayments r
       JOIN credit_sales cs ON cs.shop_id=r.shop_id AND cs.document_id=r.sale_id
       JOIN shop_customers c ON c.shop_id=cs.shop_id AND c.id=cs.customer_id
       JOIN shops s ON s.id=r.shop_id
       WHERE c.buyer_account_id=$1
       ORDER BY r.created_at DESC,r.id DESC LIMIT 100`,
      [buyerId],
    );
    return rows.map((row: any) => ({
      ...row,
      amountMinor: Number(row.amountMinor),
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
