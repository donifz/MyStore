import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { IdempotencyService } from '../common/idempotency.service';
import { minor, quantity, safeMoney } from '../common/money';
import { StockService } from './stock.service';
import { DATABASE } from '../database';
import { Inject } from '@nestjs/common';
export type ReceiveLine = {
  variantId: string;
  quantity: number;
  unitCostMinor: number;
};
export type ReceiptResult = {
  id: string;
  kind: 'receiving';
  totalMinor: number;
  documentNumber: string;
};
type ReceiveDocument =
  | ReceiveLine[]
  | {
      documentNumber?: string;
      supplier?: string;
      receivedOn?: string;
      comment?: string;
      lines: ReceiveLine[];
    };
@Injectable()
export class ReceivingService {
  constructor(
    private readonly operations: IdempotencyService,
    private readonly stock: StockService,
    @Inject(DATABASE) private readonly db: DataSource,
  ) {}
  async receive(
    shopId: string,
    actorId: string,
    key: string,
    input: ReceiveDocument,
  ): Promise<ReceiptResult> {
    key = this.operations.requireKey(key);
    const meta = Array.isArray(input)
      ? {
          documentNumber: `DOC-${key.replaceAll('-', '').slice(0, 8).toUpperCase()}`,
          receivedOn: new Date().toISOString().slice(0, 10),
          supplier: '',
          comment: '',
          lines: input,
        }
      : {
          ...input,
          documentNumber:
            input.documentNumber?.trim() ||
            `DOC-${key.replaceAll('-', '').slice(0, 8).toUpperCase()}`,
          receivedOn: input.receivedOn || new Date().toISOString().slice(0, 10),
        };
    if (!/^[-\w ]{1,120}$/.test(meta.documentNumber.trim()))
      throw new BadRequestException('Invalid receiving document number');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.receivedOn))
      throw new BadRequestException('Invalid receiving date');
    const lines = meta.lines;
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
      { kind: 'receiving', ...meta, lines: normalized },
      (tx) => this.postInTransaction(tx, shopId, actorId, normalized, meta),
    );
  }
  async postInTransaction(
    tx: EntityManager,
    shopId: string,
    actorId: string,
    normalized: ReceiveLine[],
    meta: {
      documentNumber: string;
      supplier?: string;
      receivedOn: string;
      comment?: string;
    } = {
      documentNumber: `DOC-${randomUUID().slice(0, 8).toUpperCase()}`,
      receivedOn: new Date().toISOString().slice(0, 10),
    },
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
    try {
      await tx.query(
        "INSERT INTO stock_documents(id,shop_id,actor_id,kind,total_minor,document_number,supplier,received_on,comment)VALUES($1,$2,$3,'receiving',$4,$5,$6,$7,$8)",
        [
          id,
          shopId,
          actorId,
          total,
          meta.documentNumber.trim(),
          meta.supplier?.trim() || null,
          meta.receivedOn,
          meta.comment?.trim() || null,
        ],
      );
    } catch (e: any) {
      if (e?.code === '23505')
        throw new ConflictException(
          'Document number already exists in this shop',
        );
      throw e;
    }
    for (const l of normalized) {
      const row = rows.get(l.variantId)!;
      if (row.archived)
        throw new ConflictException(
          'Cannot receive stock for archived variant',
        );
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
    return {
      id,
      kind: 'receiving',
      totalMinor: total,
      documentNumber: meta.documentNumber.trim(),
    };
  }
  async list(shopId: string) {
    return this.db.query(
      `SELECT d.id,d.document_number "documentNumber",d.supplier,d.received_on "receivedOn",d.comment,d.total_minor "totalMinor",d.created_at "createdAt",u.email "createdBy"
       FROM stock_documents d JOIN users u ON u.id=d.actor_id WHERE d.shop_id=$1 AND d.kind='receiving' ORDER BY d.created_at DESC LIMIT 100`,
      [shopId],
    );
  }
}
