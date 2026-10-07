import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

@Injectable()
export class ReportsService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  private range(from?: string, to?: string) {
    const start = from ? new Date(from) : new Date('1970-01-01T00:00:00.000Z');
    const end = to ? new Date(to) : new Date('9999-12-31T23:59:59.999Z');
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end)
      throw new BadRequestException('Invalid report period');
    return [start.toISOString(), end.toISOString()] as const;
  }

  async summary(shop: string, from?: string, to?: string) {
    const [start, end] = this.range(from, to);
    const [trade] = await this.db.query(
      `SELECT
        COALESCE((SELECT sum(total_minor) FROM stock_documents WHERE shop_id=$1 AND kind='sale' AND created_at >= $2 AND created_at < $3),0) sales,
        COALESCE((SELECT sum(total_minor) FROM stock_documents WHERE shop_id=$1 AND kind='return' AND created_at >= $2 AND created_at < $3),0) returns,
        COALESCE((SELECT sum(sl.cost_minor) FROM sale_lines sl JOIN stock_documents d ON d.shop_id=sl.shop_id AND d.id=sl.document_id WHERE sl.shop_id=$1 AND d.created_at >= $2 AND d.created_at < $3),0) sold_cost,
        COALESCE((SELECT sum(rl.cost_minor) FROM return_lines rl JOIN stock_documents d ON d.shop_id=rl.shop_id AND d.id=rl.document_id WHERE rl.shop_id=$1 AND d.created_at >= $2 AND d.created_at < $3),0) returned_cost`,
      [shop, start, end],
    );
    const [payments] = await this.db.query(
      `SELECT
        COALESCE(sum(amount_minor) FILTER (WHERE kind='sale'),0) received,
        COALESCE(sum(amount_minor) FILTER (WHERE kind='refund'),0) refunded,
        COALESCE(sum(amount_minor) FILTER (WHERE kind='sale' AND method='cash'),0) cash,
        COALESCE(sum(amount_minor) FILTER (WHERE kind='sale' AND method='card'),0) card
       FROM payment_records WHERE shop_id=$1 AND created_at >= $2 AND created_at < $3`,
      [shop, start, end],
    );
    const [inventory] = await this.db.query(
      `SELECT
        COALESCE(sum(physical),0) physical,
        COALESCE(sum(reserved),0) reserved,
        COALESCE(sum(stock_value_minor),0) stock_value,
        count(*) FILTER (WHERE physical-reserved <= 5) low_stock
       FROM stock_balances WHERE shop_id=$1`,
      [shop],
    );
    const [orders] = await this.db.query(
      `SELECT
        count(*) FILTER (WHERE status IN ('new','confirmed','ready')) open_orders,
        count(*) FILTER (WHERE status='issued' AND created_at >= $2 AND created_at < $3) issued_orders,
        COALESCE(sum(total_minor) FILTER (WHERE status='issued' AND created_at >= $2 AND created_at < $3),0) issued_total
       FROM online_orders WHERE shop_id=$1`,
      [shop, start, end],
    );
    const [shifts] = await this.db.query(
      `SELECT
        count(*) closed_shifts,
        COALESCE(sum(actual_cash_minor-expected_cash_minor),0) discrepancy
       FROM cash_shifts WHERE shop_id=$1 AND closed_at >= $2 AND closed_at < $3`,
      [shop, start, end],
    );
    const sales = Number(trade.sales), returns = Number(trade.returns);
    const cost = Number(trade.sold_cost) - Number(trade.returned_cost);
    const revenue = sales - returns;
    return {
      from: start,
      to: end,
      revenueMinor: revenue,
      salesMinor: sales,
      returnsMinor: returns,
      costOfGoodsMinor: cost,
      grossProfitMinor: revenue - cost,
      paymentsReceivedMinor: Number(payments.received),
      paymentsRefundedMinor: Number(payments.refunded),
      cashReceivedMinor: Number(payments.cash),
      cardReceivedMinor: Number(payments.card),
      physicalUnits: Number(inventory.physical),
      reservedUnits: Number(inventory.reserved),
      stockValueMinor: Number(inventory.stock_value),
      lowStockCount: Number(inventory.low_stock),
      openOrders: Number(orders.open_orders),
      issuedOrders: Number(orders.issued_orders),
      issuedOrdersMinor: Number(orders.issued_total),
      closedShifts: Number(shifts.closed_shifts),
      cashDiscrepancyMinor: Number(shifts.discrepancy),
    };
  }

  async export(shop: string, kind: string) {
    let headers: string[];
    let rows: any[];
    if (kind === 'products') {
      headers = ['sku','name','barcode','category','subcategory','sale_price_minor','published'];
      rows = await this.db.query(
        'SELECT sku,name,barcode,category,subcategory,sale_price_minor,published FROM variants WHERE shop_id=$1 ORDER BY name,id',
        [shop],
      );
    } else if (kind === 'stock') {
      headers = ['sku','name','barcode','physical','reserved','available','stock_value_minor'];
      rows = await this.db.query(
        `SELECT v.sku,v.name,v.barcode,b.physical,b.reserved,b.physical-b.reserved available,b.stock_value_minor
         FROM stock_balances b JOIN variants v ON v.shop_id=b.shop_id AND v.id=b.variant_id
         WHERE b.shop_id=$1 ORDER BY v.name,v.id`,
        [shop],
      );
    } else if (kind === 'sales') {
      headers = ['id','created_at','total_minor','payment_kind','payment_method','payment_amount_minor'];
      rows = await this.db.query(
        `SELECT d.id,d.created_at,d.total_minor,p.kind payment_kind,p.method payment_method,p.amount_minor payment_amount_minor
         FROM stock_documents d LEFT JOIN payment_records p ON p.shop_id=d.shop_id AND p.document_id=d.id
         WHERE d.shop_id=$1 AND d.kind IN ('sale','return') ORDER BY d.created_at DESC,d.id`,
        [shop],
      );
    } else if (kind === 'orders') {
      headers = ['id','created_at','status','name','phone','fulfillment','address','total_minor','sale_id'];
      rows = await this.db.query(
        'SELECT id,created_at,status,name,phone,fulfillment,address,total_minor,sale_id FROM online_orders WHERE shop_id=$1 ORDER BY created_at DESC,id',
        [shop],
      );
    } else {
      throw new BadRequestException('Unknown export');
    }
    const lines = [headers.join(',')];
    for (const row of rows)
      lines.push(headers.map((h) => csvCell(row[h])).join(','));
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }
}
