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
import { SaleLine, SalesService } from './sales.service';
import { PosSalesService } from './pos-sales.service';
import { ShiftsService } from './shifts.service';
import { PaymentMethod } from './pos.types';

@Injectable()
export class CreditSalesService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly access: ShopAccessService,
    private readonly operations: IdempotencyService,
    private readonly sales: SalesService,
    private readonly pos: PosSalesService,
    private readonly shifts: ShiftsService,
  ) {}

  async sell(input: {
    shopId: string;
    actorId: string;
    key: string;
    shiftId: string;
    customerId: string;
    method: PaymentMethod;
    paidMinor: number;
    dueOn: string;
    lines: SaleLine[];
  }) {
    const { shopId, actorId, key, method, customerId, shiftId, dueOn } = input;
    const paid = safeMoney(minor(input.paidMinor));
    const lines = this.sales.normalize(input.lines);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) {
      throw new BadRequestException('Укажите дату возврата YYYY-MM-DD');
    }
    const date = new Date(dueOn + 'T00:00:00Z');
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== dueOn
    ) {
      throw new BadRequestException('Некорректная дата возврата');
    }
    const today = new Date().toISOString().slice(0, 10);
    if (dueOn < today) {
      throw new BadRequestException('Срок возврата не может быть в прошлом');
    }
    return this.operations.execute(
      shopId,
      key,
      {
        kind: 'pos-credit-sale',
        actorId,
        shiftId,
        customerId,
        method,
        paidMinor: paid,
        dueOn,
        lines,
      },
      async (tx) => {
        const [customer] = await tx.query(
          `SELECT id,buyer_account_id,credit_approved,credit_limit_minor
           FROM shop_customers WHERE shop_id=$1 AND id=$2 FOR UPDATE`,
          [shopId, customerId],
        );
        if (!customer) throw new NotFoundException('Клиент не найден');
        if (!customer.buyer_account_id || !customer.credit_approved) {
          throw new ConflictException(
            'Кредит клиенту не разрешён или кабинет не привязан',
          );
        }
        const [balance] = await tx.query(
          `SELECT COALESCE(sum(total_minor-paid_minor),0) AS outstanding
           FROM credit_sales WHERE shop_id=$1 AND customer_id=$2`,
          [shopId, customerId],
        );
        const subtotal = lines.reduce(
          (n, l) => n + BigInt(l.quantity) * BigInt(l.expectedUnitPriceMinor),
          0n,
        );
        const total = safeMoney(subtotal);
        if (paid >= total) {
          throw new BadRequestException(
            'Для полной оплаты используйте обычную продажу',
          );
        }
        const due = total - paid;
        if (
          BigInt(balance.outstanding) + BigInt(due) >
          BigInt(customer.credit_limit_minor)
        ) {
          throw new ConflictException(
            'Превышен разрешённый лимит задолженности',
          );
        }
        const posted = await this.pos.postInTransaction(
          tx,
          shopId,
          actorId,
          shiftId,
          method,
          lines,
          false,
          paid,
        );
        await tx.query(
          `INSERT INTO credit_sales(shop_id,document_id,customer_id,paid_minor,total_minor,due_on)
           VALUES($1,$2,$3,$4,$5,$6)`,
          [shopId, posted.id, customerId, paid, posted.totalMinor, dueOn],
        );
        return {
          ...posted,
          customerId,
          paidMinor: paid,
          debtMinor: posted.totalMinor - paid,
          dueOn,
        };
      },
      (tx) =>
        this.access
          .requireMembership(actorId, shopId, 'sell', tx)
          .then(() => undefined),
    );
  }

  async repay(input: {
    shopId: string;
    actorId: string;
    key: string;
    saleId: string;
    shiftId: string;
    method: PaymentMethod;
    amountMinor: number;
  }) {
    const { shopId, actorId, key, method } = input;
    const saleId = input.saleId.toLowerCase();
    const shiftId = input.shiftId.toLowerCase();
    const amount = safeMoney(minor(input.amountMinor));
    if (amount <= 0) throw new BadRequestException('Укажите сумму погашения больше нуля');
    return this.operations.execute(
      shopId,
      key,
      { kind: 'credit-repayment', actorId, saleId, shiftId, method, amountMinor: amount },
      async (tx) => {
        // Lock the open shift before the debt row: consistent with sale checkout.
        await this.shifts.lockOpen(tx, shopId, shiftId, actorId);
        const [sale] = await tx.query(
          `SELECT customer_id,total_minor,paid_minor
           FROM credit_sales WHERE shop_id=$1 AND document_id=$2 FOR UPDATE`,
          [shopId, saleId],
        );
        if (!sale) throw new NotFoundException('Продажа в долг не найдена');
        const balance = BigInt(sale.total_minor) - BigInt(sale.paid_minor);
        if (BigInt(amount) > balance) {
          throw new ConflictException('Погашение превышает остаток долга');
        }
        const id = randomUUID();
        await tx.query(
          `INSERT INTO credit_repayments
           (shop_id,id,document_id,shift_id,actor_id,method,amount_minor)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [shopId, id, saleId, shiftId, actorId, method, amount],
        );
        await tx.query(
          `UPDATE credit_sales
           SET paid_minor=paid_minor+$3
           WHERE shop_id=$1 AND document_id=$2`,
          [shopId, saleId, amount],
        );
        return {
          id,
          saleId,
          customerId: sale.customer_id,
          shiftId,
          method,
          amountMinor: amount,
          debtMinor: safeMoney(balance - BigInt(amount)),
        };
      },
      (tx) =>
        this.access
          .requireMembership(actorId, shopId, 'sell', tx)
          .then(() => undefined),
    );
  }

  async repayments(shopId: string, saleId: string) {
    const [sale] = await this.db.query(
      'SELECT document_id FROM credit_sales WHERE shop_id=$1 AND document_id=$2',
      [shopId, saleId],
    );
    if (!sale) throw new NotFoundException('Продажа в долг не найдена');
    const rows = await this.db.query(
      `SELECT id,document_id AS "saleId",shift_id AS "shiftId",
       method,amount_minor AS "amountMinor",created_at AS "createdAt"
       FROM credit_repayments WHERE shop_id=$1 AND document_id=$2
       ORDER BY created_at DESC,id DESC LIMIT 100`,
      [shopId, saleId],
    );
    return rows.map((r: any) => ({ ...r, amountMinor: Number(r.amountMinor) }));
  }

  async buyerDebts(buyerId: string) {
    const rows = await this.db.query(
      `SELECT cs.document_id AS "saleId",cs.shop_id AS "shopId",
       s.name AS "shopName",cs.total_minor AS "totalMinor",
       cs.paid_minor AS "paidMinor",
       (cs.total_minor-cs.paid_minor) AS "debtMinor",
       cs.due_on AS "dueOn",cs.created_at AS "createdAt"
       FROM credit_sales cs
       JOIN shop_customers sc ON sc.shop_id=cs.shop_id AND sc.id=cs.customer_id
       JOIN shops s ON s.id=cs.shop_id
       WHERE sc.buyer_account_id=$1
       ORDER BY cs.created_at DESC LIMIT 100`,
      [buyerId],
    );
    return rows.map((row: any) => ({
      ...row,
      totalMinor: Number(row.totalMinor),
      paidMinor: Number(row.paidMinor),
      debtMinor: Number(row.debtMinor),
    }));
  }

  async list(shopId: string, customerId: string) {
    const rows = await this.db.query(
      `SELECT document_id AS "saleId",total_minor AS "totalMinor",
       paid_minor AS "paidMinor",
       (total_minor-paid_minor) AS "debtMinor",
       due_on AS "dueOn",created_at AS "createdAt"
       FROM credit_sales WHERE shop_id=$1 AND customer_id=$2
       ORDER BY created_at DESC LIMIT 100`,
      [shopId, customerId],
    );
    return rows.map((x: any) => ({
      ...x,
      totalMinor: Number(x.totalMinor),
      paidMinor: Number(x.paidMinor),
      debtMinor: Number(x.debtMinor),
    }));
  }
}
