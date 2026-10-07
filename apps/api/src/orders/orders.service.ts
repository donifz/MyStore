import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { DATABASE } from '../database';
import { IdempotencyService } from '../common/idempotency.service';
import { safeMoney } from '../common/money';
import { StockService } from '../inventory/stock.service';
import { SalesService, SaleLine } from '../pos/sales.service';
import { PosSalesService } from '../pos/pos-sales.service';
import { PaymentMethod } from '../pos/pos.types';
import { OrderExpirationService } from './order-expiration.service';
export type CheckoutInput = {
  checkoutKey: string;
  storeSlug: string;
  name: string;
  phone: string;
  fulfillment: 'pickup' | 'delivery';
  address: string;
  comment: string;
  lines: SaleLine[];
};
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
@Injectable()
export class OrdersService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly stock: StockService,
    private readonly sales: SalesService,
    private readonly pos: PosSalesService,
    private readonly ops: IdempotencyService,
    private readonly expiry: OrderExpirationService,
  ) {}
  private receiptDto(o: any) {
    return {
      id: o.id,
      status: o.status,
      totalMinor: Number(o.total_minor),
      expiresAt: o.expires_at?.toISOString() ?? null,
      storeName: o.store_name,
    };
  }
  async create(input: CheckoutInput) {
    const payload = {
      storeSlug: input.storeSlug,
      name: input.name.trim(),
      phone: input.phone.replace(/\D/g, ''),
      fulfillment: input.fulfillment,
      address: input.address.trim(),
      comment: input.comment.trim(),
      lines: this.sales.normalize(input.lines),
    };
    if (
      !payload.name ||
      !/^\d{7,15}$/.test(payload.phone) ||
      (payload.fulfillment === 'delivery' && !payload.address)
    )
      throw new BadRequestException(
        'Name, phone and delivery address required',
      );
    const digest = hash(input.checkoutKey.toLowerCase()),
      fingerprint = hash(JSON.stringify(payload));
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'public-order:' + digest,
      ]);
      const [existing] = await tx.query(
        'SELECT * FROM online_orders WHERE checkout_hash=$1',
        [digest],
      );
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          throw new ConflictException('Checkout key already used');
        return this.receiptDto(existing);
      }
      const [shop] = await tx.query(
        'SELECT id,name FROM shops WHERE slug=$1 AND published FOR SHARE',
        [payload.storeSlug],
      );
      if (!shop) throw new NotFoundException('Store unavailable');
      // Keep recovery behind this key lock throughout expiry catch-up.
      await this.expiry.expireForCheckout(tx, shop.id);
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'order-phone:' + shop.id + ':' + payload.phone,
      ]);
      const [pending] = await tx.query(
        "SELECT count(*)::int n FROM online_orders WHERE shop_id=$1 AND phone=$2 AND status='new' AND expires_at>now()",
        [shop.id, payload.phone],
      );
      if (pending.n >= 3)
        throw new HttpException('Too many pending orders', 429);
      const stocks = await this.stock.lock(
        tx,
        shop.id,
        payload.lines.map((l) => l.variantId),
      );
      for (const line of payload.lines) {
        const [variant] = await tx.query(
          'SELECT published FROM variants WHERE shop_id=$1 AND id=$2',
          [shop.id, line.variantId],
        );
        if (!variant?.published)
          throw new NotFoundException('Product unavailable');
        const b = stocks.get(line.variantId)!;
        if (Number(b.sale_price_minor) !== line.expectedUnitPriceMinor)
          throw new ConflictException({
            message: 'Price changed',
            variantId: line.variantId,
            currentUnitPriceMinor: Number(b.sale_price_minor),
          });
        if (Number(b.physical) - Number(b.reserved) < line.quantity)
          throw new ConflictException({
            message: 'Insufficient available stock',
            variantId: line.variantId,
            available: Number(b.physical) - Number(b.reserved),
          });
      }
      const total = safeMoney(
        payload.lines.reduce(
          (sum, l) =>
            sum + BigInt(l.quantity) * BigInt(l.expectedUnitPriceMinor),
          0n,
        ),
      );
      const id = randomUUID();
      const [order] = await tx.query(
        "INSERT INTO online_orders(id,shop_id,checkout_hash,fingerprint,store_name,name,phone,fulfillment,address,comment,total_minor,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()+interval '30 minutes') RETURNING *",
        [
          id,
          shop.id,
          digest,
          fingerprint,
          shop.name,
          payload.name,
          payload.phone,
          payload.fulfillment,
          payload.address,
          payload.comment,
          total,
        ],
      );
      for (const l of payload.lines) {
        await tx.query(
          'INSERT INTO online_order_lines(shop_id,order_id,variant_id,name,barcode,quantity,unit_price_minor) SELECT $1,$2,id,name,barcode,$4,$5 FROM variants WHERE shop_id=$1 AND id=$3',
          [shop.id, id, l.variantId, l.quantity, l.expectedUnitPriceMinor],
        );
        await tx.query(
          'UPDATE stock_balances SET reserved=reserved+$3 WHERE shop_id=$1 AND variant_id=$2',
          [shop.id, l.variantId, l.quantity],
        );
      }
      return this.receiptDto(order);
    });
  }
  async receipt(key: string) {
    const digest = hash(key.toLowerCase());
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'public-order:' + digest,
      ]);
      const [row] = await tx.query(
        'SELECT * FROM online_orders WHERE checkout_hash=$1 FOR UPDATE',
        [digest],
      );
      if (!row) throw new NotFoundException();
      const order =
        row.status === 'new' && row.expires_at.getTime() <= Date.now()
          ? await this.expiry.release(tx, row, 'expired')
          : row;
      return this.receiptDto(order);
    });
  }

  private detailDto(o: any) {
    return {
      ...this.receiptDto(o),
      name: o.name,
      phone: o.phone,
      fulfillment: o.fulfillment,
      address: o.address,
      comment: o.comment,
      createdAt: o.created_at.toISOString(),
      saleId: o.sale_id,
    };
  }
  async list(shop: string, page: number, pageSize: number) {
    await this.expiry.expire(shop);
    const [count] = await this.db.query(
      'SELECT count(*)::int total FROM online_orders WHERE shop_id=$1',
      [shop],
    );
    const rows = await this.db.query(
      'SELECT * FROM online_orders WHERE shop_id=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3',
      [shop, pageSize, (page - 1) * pageSize],
    );
    return {
      items: rows.map((r: any) => this.detailDto(r)),
      total: count.total,
      page,
      pageSize,
    };
  }
  async detail(shop: string, id: string) {
    await this.expiry.expire(shop);
    const [o] = await this.db.query(
      'SELECT * FROM online_orders WHERE shop_id=$1 AND id=$2',
      [shop, id],
    );
    if (!o) throw new NotFoundException();
    const lines = await this.db.query(
      'SELECT variant_id,name,barcode,quantity,unit_price_minor FROM online_order_lines WHERE shop_id=$1 AND order_id=$2 ORDER BY variant_id',
      [shop, id],
    );
    return {
      ...this.detailDto(o),
      lines: lines.map((l: any) => ({
        variantId: l.variant_id,
        name: l.name,
        barcode: l.barcode,
        quantity: Number(l.quantity),
        unitPriceMinor: Number(l.unit_price_minor),
      })),
    };
  }
  private async lock(tx: EntityManager, shop: string, id: string) {
    const [o] = await tx.query(
      'SELECT * FROM online_orders WHERE shop_id=$1 AND id=$2 FOR UPDATE',
      [shop, id],
    );
    if (!o) throw new NotFoundException();
    if (o.status === 'new' && o.expires_at.getTime() <= Date.now())
      return this.expiry.release(tx, o, 'expired');
    return o;
  }
  async status(
    shop: string,
    id: string,
    status: 'confirmed' | 'ready' | 'cancelled',
  ) {
    // A terminal expired state must commit even when the requested transition cannot.
    await this.expiry.expire(shop);
    const result = await this.db.transaction(async (tx) => {
      const o = await this.lock(tx, shop, id);
      if (o.status === status) return this.receiptDto(o);
      if (o.status === 'expired') return null;
      if (
        status === 'cancelled' &&
        ['new', 'confirmed', 'ready'].includes(o.status)
      )
        return this.receiptDto(await this.expiry.release(tx, o, 'cancelled'));
      if (!(
        (o.status === 'new' && status === 'confirmed') ||
        (o.status === 'confirmed' && status === 'ready')
      ))
        throw new ConflictException('Invalid order transition');
      const [[updated]] = await tx.query(
        'UPDATE online_orders SET status=$3,expires_at=NULL,updated_at=now() WHERE shop_id=$1 AND id=$2 RETURNING *',
        [shop, id, status],
      );
      return this.receiptDto(updated);
    });
    if (!result) throw new ConflictException('Order expired');
    return result;
  }
  async issue(
    shop: string,
    id: string,
    actor: string,
    key: string,
    shiftId: string,
    method: PaymentMethod,
  ) {
    shiftId = shiftId.toLowerCase();
    return this.ops.execute(
      shop,
      key,
      { kind: 'order-issue', id, actor, shiftId, method },
      async (tx) => {
        const o = await this.lock(tx, shop, id);
        if (o.status === 'issued') {
          const [p] = await tx.query(
            'SELECT shift_id,method FROM payment_records WHERE shop_id=$1 AND document_id=$2',
            [shop, o.sale_id],
          );
          if (
            o.issued_by !== actor ||
            p.shift_id !== shiftId ||
            p.method !== method
          )
            throw new ConflictException('Order already issued');
          return { ...this.receiptDto(o), saleId: o.sale_id };
        }
        if (o.status !== 'ready')
          throw new ConflictException('Order must be ready');
        const rows = await tx.query(
          'SELECT variant_id,quantity,unit_price_minor FROM online_order_lines WHERE shop_id=$1 AND order_id=$2 ORDER BY variant_id',
          [shop, id],
        );
        const lines = rows.map((l: any) => ({
          variantId: l.variant_id,
          quantity: Number(l.quantity),
          expectedUnitPriceMinor: Number(l.unit_price_minor),
        }));
        const sale = await this.pos.postInTransaction(
          tx,
          shop,
          actor,
          shiftId,
          method,
          lines,
          true,
        );
        const [[updated]] = await tx.query(
          "UPDATE online_orders SET status='issued',sale_id=$3,issued_by=$4,updated_at=now() WHERE shop_id=$1 AND id=$2 RETURNING *",
          [shop, id, sale.id, actor],
        );
        return { ...this.receiptDto(updated), saleId: sale.id };
      },
    );
  }
}
