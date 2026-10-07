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
  async expire() {
    for (let i = 0; i < 100; i++) {
      const found = await this.db.transaction(async (tx) => {
        const [o] = await tx.query(
          "SELECT * FROM online_orders WHERE status='new' AND expires_at<=now() ORDER BY expires_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",
        );
        if (!o) return false;
        await this.release(tx, o, 'expired');
        return true;
      });
      if (!found) break;
    }
  }
}
