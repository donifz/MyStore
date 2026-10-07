import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DATABASE } from '../database';
import { StockService } from '../inventory/stock.service';

@Injectable()
export class OrderExpirationService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly stock: StockService,
  ) {}
  // Caller owns the order row lock. Every stock writer uses the same sorted locks.
  async release(
    tx: EntityManager,
    order: any,
    status: 'expired' | 'cancelled',
  ) {
    const lines = await tx.query(
      'SELECT variant_id,quantity FROM online_order_lines WHERE shop_id=$1 AND order_id=$2 ORDER BY variant_id',
      [order.shop_id, order.id],
    );
    await this.stock.lock(
      tx,
      order.shop_id,
      lines.map((l: any) => l.variant_id),
    );
    for (const l of lines)
      await tx.query(
        'UPDATE stock_balances SET reserved=reserved-$3 WHERE shop_id=$1 AND variant_id=$2',
        [order.shop_id, l.variant_id, l.quantity],
      );
    const [[updated]] = await tx.query(
      'UPDATE online_orders SET status=$3,expires_at=NULL,updated_at=now() WHERE shop_id=$1 AND id=$2 RETURNING *',
      [order.shop_id, order.id, status],
    );
    return updated;
  }
  async expire(shop?: string) {
    // Each transaction is bounded to one order; drain all available overdue
    // work before startup completes. Checkout scopes catch-up to its shop.
    for (;;) {
      const found = await this.db.transaction(async (tx) => {
        const [o] = await tx.query(
          "SELECT * FROM online_orders WHERE status='new' AND expires_at<=now() AND ($1::uuid IS NULL OR shop_id=$1) ORDER BY expires_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",
          [shop ?? null],
        );
        if (!o) return false;
        await this.release(tx, o, 'expired');
        return true;
      });
      if (!found) break;
    }
  }
  async expireForCheckout(tx: EntityManager, shop: string) {
    // Acquire every relevant order lock before any stock lock, then lock the
    // union of variants in sorted order. This avoids both nested pool waits
    // and cross-order stock lock inversions during a checkout transaction.
    const orders = await tx.query(
      "SELECT * FROM online_orders WHERE shop_id=$1 AND status='new' AND expires_at<=now() ORDER BY id FOR UPDATE",
      [shop],
    );
    if (!orders.length) return;
    const lines = await tx.query(
      'SELECT DISTINCT variant_id FROM online_order_lines WHERE shop_id=$1 AND order_id=ANY($2::uuid[]) ORDER BY variant_id',
      [shop, orders.map((o: any) => o.id)],
    );
    await this.stock.lock(
      tx,
      shop,
      lines.map((l: any) => l.variant_id),
    );
    for (const order of orders) await this.release(tx, order, 'expired');
  }
}
