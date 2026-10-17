import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { DATABASE } from '../database';
import { IdempotencyService } from '../common/idempotency.service';
import { minor, safeMoney, MAX_MONEY } from '../common/money';
import { ShiftView, CashTransactionView } from './pos.types';
export function signedMoney(n: bigint) {
  if (n > MAX_MONEY || n < -MAX_MONEY)
    throw new BadRequestException('Money outside safe range');
  return Number(n);
}
@Injectable()
export class ShiftsService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly ops: IdempotencyService,
  ) {}
  async view(tx: EntityManager, row: any): Promise<ShiftView> {
    const [sum] = await tx.query(
      "SELECT COALESCE(sum(CASE WHEN kind='sale' THEN amount_minor ELSE -amount_minor END),0) n FROM payment_records WHERE shop_id=$1 AND shift_id=$2 AND method='cash'",
      [row.shop_id, row.id],
    );
    const [totals] = await tx.query(
      "SELECT COALESCE(sum(amount_minor) FILTER(WHERE kind='sale' AND method='cash'),0) sc,COALESCE(sum(amount_minor) FILTER(WHERE kind='sale' AND method='card'),0) sd,COALESCE(sum(amount_minor) FILTER(WHERE kind='refund' AND method='cash'),0) rc,COALESCE(sum(amount_minor) FILTER(WHERE kind='refund' AND method='card'),0) rd FROM payment_records WHERE shop_id=$1 AND shift_id=$2",
      [row.shop_id, row.id],
    );
    const [cashTxs] = await tx.query(
      "SELECT COALESCE(sum(amount_minor) FILTER(WHERE type='in'),0) cin, COALESCE(sum(amount_minor) FILTER(WHERE type='out'),0) cout FROM cash_transactions WHERE shop_id=$1 AND shift_id=$2",
      [row.shop_id, row.id],
    );
    const cin = BigInt(cashTxs?.cin || 0);
    const cout = BigInt(cashTxs?.cout || 0);
    const expected = row.closed_at
      ? BigInt(row.expected_cash_minor)
      : BigInt(row.opening_cash_minor) + BigInt(sum.n) + cin - cout;
    return {
      salesCashMinor: safeMoney(BigInt(totals.sc)),
      salesCardMinor: safeMoney(BigInt(totals.sd)),
      refundsCashMinor: safeMoney(BigInt(totals.rc)),
      refundsCardMinor: safeMoney(BigInt(totals.rd)),
      cashInMinor: safeMoney(cin),
      cashOutMinor: safeMoney(cout),
      id: row.id,
      shopId: row.shop_id,
      actorId: row.actor_id,
      status: row.closed_at ? 'closed' : 'open',
      openingCashMinor: Number(row.opening_cash_minor),
      expectedCashMinor: signedMoney(expected),
      actualCashMinor:
        row.actual_cash_minor === null ? null : Number(row.actual_cash_minor),
      discrepancyMinor: row.closed_at
        ? signedMoney(BigInt(row.actual_cash_minor) - expected)
        : null,
      comment: row.comment,
      openedAt: row.opened_at.toISOString(),
      closedAt: row.closed_at?.toISOString() ?? null,
    };
  }
  async lockOpen(
    tx: EntityManager,
    shopId: string,
    shiftId: string,
    actorId: string,
  ): Promise<ShiftView> {
    const [row] = await tx.query(
      'SELECT * FROM cash_shifts WHERE shop_id=$1 AND id=$2 FOR UPDATE',
      [shopId, shiftId],
    );
    if (!row) throw new NotFoundException('Shift not found');
    if (row.actor_id !== actorId)
      throw new ForbiddenException('Not your shift');
    if (row.closed_at) throw new ConflictException('Shift closed');
    return this.view(tx, row);
  }
  async open(
    shopId: string,
    actorId: string,
    key: string,
    openingCashMinor: number,
  ) {
    const amount = safeMoney(minor(openingCashMinor));
    return this.ops.execute(
      shopId,
      key,
      { kind: 'shift-open', actorId, openingCashMinor: amount },
      async (tx) => {
        await tx.query('SELECT id FROM shops WHERE id=$1 FOR UPDATE', [shopId]);
        const [member] = await tx.query(
          'SELECT role FROM memberships WHERE shop_id=$1 AND user_id=$2',
          [shopId, actorId],
        );
        if (!member) throw new ForbiddenException();
        await tx.query(
          'INSERT INTO cash_registers(shop_id) VALUES($1) ON CONFLICT DO NOTHING',
          [shopId],
        );
        const [register] = await tx.query(
          'SELECT id FROM cash_registers WHERE shop_id=$1 FOR UPDATE',
          [shopId],
        );
        const [active] = await tx.query(
          'SELECT id FROM cash_shifts WHERE shop_id=$1 AND closed_at IS NULL',
          [shopId],
        );
        if (active) throw new ConflictException('Register occupied');
        const [row] = await tx.query(
          'INSERT INTO cash_shifts(id,shop_id,register_id,actor_id,opening_cash_minor) VALUES($1,$2,$3,$4,$5) RETURNING *',
          [randomUUID(), shopId, register.id, actorId, amount],
        );
        return this.view(tx, row);
      },
    );
  }
  async active(shopId: string) {
    const [row] = await this.db.query(
      'SELECT * FROM cash_shifts WHERE shop_id=$1 AND closed_at IS NULL',
      [shopId],
    );
    return row ? this.view(this.db.manager, row) : null;
  }
  async current(shopId: string, actorId: string) {
    const [row] = await this.db.query(
      'SELECT * FROM cash_shifts WHERE shop_id=$1 AND closed_at IS NULL',
      [shopId],
    );
    return !row
      ? null
      : row.actor_id !== actorId
        ? { occupied: true }
        : this.view(this.db.manager, row);
  }
  async get(shopId: string, id: string, actorId: string, owner: boolean) {
    const [row] = await this.db.query(
      'SELECT * FROM cash_shifts WHERE shop_id=$1 AND id=$2',
      [shopId, id],
    );
    if (!row) throw new NotFoundException();
    if (!owner && row.actor_id !== actorId) throw new ForbiddenException();
    return this.view(this.db.manager, row);
  }
  async close(
    shopId: string,
    id: string,
    actorId: string,
    owner: boolean,
    key: string,
    actualCashMinor: number,
    comment?: string,
  ) {
    const amount = safeMoney(minor(actualCashMinor));
    const note = comment?.trim() || null;
    return this.ops.execute(
      shopId,
      key,
      {
        kind: 'shift-close',
        actorId,
        shiftId: id.toLowerCase(),
        actualCashMinor: amount,
        comment: note,
      },
      async (tx) => {
        const [row] = await tx.query(
          'SELECT * FROM cash_shifts WHERE shop_id=$1 AND id=$2 FOR UPDATE',
          [shopId, id],
        );
        if (!row) throw new NotFoundException();
        if (!owner && row.actor_id !== actorId) throw new ForbiddenException();
        if (row.closed_at) throw new ConflictException('Shift closed');
        const view = await this.view(tx, row);
        if (
          (amount !== view.expectedCashMinor || row.actor_id !== actorId) &&
          !note
        )
          throw new BadRequestException('Comment required');
        signedMoney(BigInt(amount) - BigInt(view.expectedCashMinor));
        await tx.query(
          'UPDATE cash_shifts SET actual_cash_minor=$3,expected_cash_minor=$4,comment=$5,closed_at=now() WHERE shop_id=$1 AND id=$2 RETURNING *',
          [shopId, id, amount, view.expectedCashMinor, note],
        );
        const [closed] = await tx.query(
          'SELECT * FROM cash_shifts WHERE shop_id=$1 AND id=$2',
          [shopId, id],
        );
        return this.view(tx, closed);
      },
    );
  }
  async cashIn(
    shopId: string,
    shiftId: string,
    actorId: string,
    key: string,
    amountMinor: number,
    reason: string,
  ): Promise<CashTransactionView> {
    const amount = safeMoney(minor(amountMinor));
    const trimmedReason = reason?.trim();
    if (!trimmedReason) throw new BadRequestException('Reason required');
    shiftId = shiftId.toLowerCase();
    return this.ops.execute(
      shopId,
      key,
      {
        kind: 'cash-in',
        actorId,
        shiftId,
        amountMinor: amount,
        reason: trimmedReason,
      },
      async (tx) => {
        await this.lockOpen(tx, shopId, shiftId, actorId);
        const id = randomUUID();
        const [row] = await tx.query(
          'INSERT INTO cash_transactions(id,shop_id,shift_id,actor_id,type,amount_minor,reason) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
          [id, shopId, shiftId, actorId, 'in', amount, trimmedReason],
        );
        return {
          id: row.id,
          shopId: row.shop_id,
          shiftId: row.shift_id,
          actorId: row.actor_id,
          type: row.type,
          amountMinor: Number(row.amount_minor),
          reason: row.reason,
          createdAt: row.created_at.toISOString(),
        };
      },
    );
  }
  async cashOut(
    shopId: string,
    shiftId: string,
    actorId: string,
    key: string,
    amountMinor: number,
    reason: string,
  ): Promise<CashTransactionView> {
    const amount = safeMoney(minor(amountMinor));
    const trimmedReason = reason?.trim();
    if (!trimmedReason) throw new BadRequestException('Reason required');
    shiftId = shiftId.toLowerCase();
    return this.ops.execute(
      shopId,
      key,
      {
        kind: 'cash-out',
        actorId,
        shiftId,
        amountMinor: amount,
        reason: trimmedReason,
      },
      async (tx) => {
        const [shiftRow] = await tx.query(
          'SELECT * FROM cash_shifts WHERE shop_id=$1 AND id=$2 FOR UPDATE',
          [shopId, shiftId],
        );
        if (!shiftRow) throw new NotFoundException('Shift not found');
        if (shiftRow.actor_id !== actorId)
          throw new ForbiddenException('Not your shift');
        if (shiftRow.closed_at) throw new ConflictException('Shift closed');
        const currentView = await this.view(tx, shiftRow);
        if (BigInt(amount) > BigInt(currentView.expectedCashMinor)) {
          throw new BadRequestException(
            'Withdrawal amount exceeds cash in register',
          );
        }
        const id = randomUUID();
        const [row] = await tx.query(
          'INSERT INTO cash_transactions(id,shop_id,shift_id,actor_id,type,amount_minor,reason) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
          [id, shopId, shiftId, actorId, 'out', amount, trimmedReason],
        );
        return {
          id: row.id,
          shopId: row.shop_id,
          shiftId: row.shift_id,
          actorId: row.actor_id,
          type: row.type,
          amountMinor: Number(row.amount_minor),
          reason: row.reason,
          createdAt: row.created_at.toISOString(),
        };
      },
    );
  }
  async listTransactions(
    shopId: string,
    shiftId: string,
    actorId: string,
    privileged: boolean,
  ): Promise<CashTransactionView[]> {
    const [shift] = await this.db.query(
      'SELECT * FROM cash_shifts WHERE shop_id=$1 AND id=$2',
      [shopId, shiftId],
    );
    if (!shift) throw new NotFoundException('Shift not found');
    if (!privileged && shift.actor_id !== actorId) {
      throw new ForbiddenException();
    }
    const rows = await this.db.query(
      'SELECT * FROM cash_transactions WHERE shop_id=$1 AND shift_id=$2 ORDER BY created_at ASC',
      [shopId, shiftId],
    );
    return rows.map((row: any) => ({
      id: row.id,
      shopId: row.shop_id,
      shiftId: row.shift_id,
      actorId: row.actor_id,
      type: row.type,
      amountMinor: Number(row.amount_minor),
      reason: row.reason,
      createdAt: row.created_at.toISOString(),
    }));
  }
}
