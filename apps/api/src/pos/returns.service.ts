import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IdempotencyService } from '../common/idempotency.service';
import { safeMoney, quantity } from '../common/money';
import { StockService } from '../inventory/stock.service';
import { ShiftsService } from './shifts.service';
import { ReturnInput, ReturnResult } from './pos.types';
@Injectable()
export class ReturnsService {
  constructor(
    private readonly ops: IdempotencyService,
    private readonly stock: StockService,
    private readonly shifts: ShiftsService,
  ) {}
  async return(
    shopId: string,
    actorId: string,
    key: string,
    input: ReturnInput,
  ): Promise<ReturnResult> {
    const lines = input.lines
      .map((l) => ({
        ...l,
        saleLineId: l.saleLineId.toLowerCase(),
        quantity: quantity(l.quantity),
      }))
      .sort((a, b) => a.saleLineId.localeCompare(b.saleLineId));
    if (new Set(lines.map((l) => l.saleLineId)).size !== lines.length)
      throw new BadRequestException('Duplicate return lines');
    const reason = input.reason.trim();
    if (!reason) throw new BadRequestException('Reason required');
    if (
      input.refundMoney
        ? !input.shiftId || !input.method
        : input.shiftId !== undefined || input.method !== undefined
    )
      throw new BadRequestException('Invalid refund payment fields');
    const saleId = input.saleId.toLowerCase(),
      shiftId = input.shiftId?.toLowerCase();
    return this.ops.execute(
      shopId,
      key,
      {
        kind: 'return',
        actorId,
        saleId,
        shiftId: shiftId ?? null,
        method: input.method ?? null,
        refundMoney: input.refundMoney,
        reason,
        lines,
      },
      async (tx) => {
        if (input.refundMoney)
          await this.shifts.lockOpen(tx, shopId, shiftId!, actorId);
        const [sale] = await tx.query(
          "SELECT d.id,p.document_id paid FROM stock_documents d LEFT JOIN pos_sales p ON p.shop_id=d.shop_id AND p.document_id=d.id WHERE d.shop_id=$1 AND d.id=$2 AND d.kind='sale'",
          [shopId, saleId],
        );
        if (!sale) throw new NotFoundException('Sale not found');
        if (input.refundMoney && !sale.paid)
          throw new ConflictException('Legacy payment unknown');
        const parts = [];
        let total = 0n;
        for (const l of lines) {
          const [row] = await tx.query(
            'SELECT * FROM sale_lines WHERE shop_id=$1 AND document_id=$2 AND id=$3 FOR UPDATE',
            [shopId, saleId, l.saleLineId],
          );
          if (!row) throw new NotFoundException('Sale line not found');
          const [returned] = await tx.query(
            'SELECT COALESCE(sum(quantity),0) n FROM return_lines WHERE shop_id=$1 AND sale_line_id=$2',
            [shopId, l.saleLineId],
          );
          const r = BigInt(returned.n),
            q = BigInt(l.quantity),
            Q = BigInt(row.quantity),
            C = BigInt(row.cost_minor);
          if (r + q > Q)
            throw new ConflictException('Return exceeds sale quantity');
          const half = (n: bigint) => (2n * C * n + Q) / (2n * Q);
          const cost = safeMoney(half(r + q) - half(r));
          total += q * BigInt(row.unit_price_minor);
          parts.push({ line: l, row, cost });
        }
        const amount = safeMoney(total);
        const stocks = await this.stock.lock(
          tx,
          shopId,
          parts
            .filter((p) => p.line.condition === 'resellable')
            .map((p) => p.row.variant_id),
        );
        const id = randomUUID();
        await tx.query(
          "INSERT INTO stock_documents(id,shop_id,actor_id,kind,total_minor) VALUES($1,$2,$3,'return',$4)",
          [id, shopId, actorId, amount],
        );
        await tx.query(
          'INSERT INTO return_documents(shop_id,document_id,sale_id,reason,refund_money) VALUES($1,$2,$3,$4,$5)',
          [shopId, id, saleId, reason, input.refundMoney],
        );
        for (const { line: l, row, cost } of parts) {
          if (l.condition === 'resellable') {
            const stock = stocks.get(row.variant_id)!;
            if (BigInt(stock.physical) + BigInt(l.quantity) > 1000000000n)
              throw new BadRequestException('Quantity overflow');
            safeMoney(BigInt(stock.stock_value_minor) + BigInt(cost));
            await tx.query(
              'UPDATE stock_balances SET physical=physical+$3,stock_value_minor=stock_value_minor+$4 WHERE shop_id=$1 AND variant_id=$2',
              [shopId, row.variant_id, l.quantity, cost],
            );
            await tx.query(
              'INSERT INTO stock_movements(id,shop_id,document_id,variant_id,quantity,value_minor) VALUES($1,$2,$3,$4,$5,$6)',
              [randomUUID(), shopId, id, row.variant_id, l.quantity, cost],
            );
          }
          await tx.query(
            'INSERT INTO return_lines(id,shop_id,document_id,sale_line_id,quantity,condition,unit_price_minor,cost_minor) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [
              randomUUID(),
              shopId,
              id,
              l.saleLineId,
              l.quantity,
              l.condition,
              row.unit_price_minor,
              cost,
            ],
          );
        }
        if (input.refundMoney) {
          await tx.query(
            "INSERT INTO payment_records(id,shop_id,document_id,shift_id,actor_id,kind,method,amount_minor) VALUES($1,$2,$3,$4,$5,'refund',$6,$7)",
            [randomUUID(), shopId, id, shiftId, actorId, input.method, amount],
          );
          await this.shifts.lockOpen(tx, shopId, shiftId!, actorId);
        }
        return {
          id,
          kind: 'return',
          totalMinor: amount,
          refundedMinor: input.refundMoney ? amount : 0,
        };
      },
    );
  }
}
