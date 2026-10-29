import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
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
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start >= end
    )
      throw new BadRequestException('Invalid report period');
    return [start.toISOString(), end.toISOString()] as const;
  }

  async summary(shop: string, from?: string, to?: string, tx?: EntityManager) {
    const db = tx ?? this.db;
    const [start, end] = this.range(from, to);
    const [trade] = await db.query(
      `SELECT
        COALESCE((SELECT sum(total_minor) FROM stock_documents WHERE shop_id=$1 AND kind='sale' AND created_at >= $2 AND created_at < $3),0) sales,
        COALESCE((SELECT sum(total_minor) FROM stock_documents WHERE shop_id=$1 AND kind='return' AND created_at >= $2 AND created_at < $3),0) returns,
        COALESCE((SELECT count(*) FROM stock_documents WHERE shop_id=$1 AND kind='return' AND created_at >= $2 AND created_at < $3),0) returns_count,
        COALESCE((SELECT sum(total_minor) FROM stock_documents d WHERE d.shop_id=$1 AND d.kind='sale' AND d.created_at >= $2 AND d.created_at < $3 AND NOT EXISTS (SELECT 1 FROM online_orders o WHERE o.shop_id=$1 AND o.sale_id=d.id)),0) pos_sales,
        COALESCE((SELECT count(*) FROM stock_documents d WHERE d.shop_id=$1 AND d.kind='sale' AND d.created_at >= $2 AND d.created_at < $3 AND NOT EXISTS (SELECT 1 FROM online_orders o WHERE o.shop_id=$1 AND o.sale_id=d.id)),0) pos_sales_count,
        COALESCE((SELECT sum(total_minor) FROM stock_documents d WHERE d.shop_id=$1 AND d.kind='sale' AND d.created_at >= $2 AND d.created_at < $3 AND EXISTS (SELECT 1 FROM online_orders o WHERE o.shop_id=$1 AND o.sale_id=d.id)),0) online_sales,
        COALESCE((SELECT count(*) FROM stock_documents d WHERE d.shop_id=$1 AND d.kind='sale' AND d.created_at >= $2 AND d.created_at < $3 AND EXISTS (SELECT 1 FROM online_orders o WHERE o.shop_id=$1 AND o.sale_id=d.id)),0) online_sales_count,
        COALESCE((SELECT sum(sl.cost_minor) FROM sale_lines sl JOIN stock_documents d ON d.shop_id=sl.shop_id AND d.id=sl.document_id WHERE sl.shop_id=$1 AND d.created_at >= $2 AND d.created_at < $3),0) sold_cost,
        COALESCE((SELECT sum(rl.cost_minor) FROM return_lines rl JOIN stock_documents d ON d.shop_id=rl.shop_id AND d.id=rl.document_id WHERE rl.shop_id=$1 AND d.created_at >= $2 AND d.created_at < $3),0) returned_cost`,
      [shop, start, end],
    );
    const [payments] = await db.query(
      `SELECT
        COALESCE(sum(amount_minor) FILTER (WHERE kind='sale'),0) received,
        COALESCE(sum(amount_minor) FILTER (WHERE kind='refund'),0) refunded,
        COALESCE(sum(amount_minor) FILTER (WHERE kind='sale' AND method='cash'),0) cash,
        COALESCE(sum(amount_minor) FILTER (WHERE kind='sale' AND method='card'),0) card
       FROM payment_records WHERE shop_id=$1 AND created_at >= $2 AND created_at < $3`,
      [shop, start, end],
    );
    const [inventory] = await db.query(
      `SELECT
        COALESCE(sum(physical),0) physical,
        COALESCE(sum(reserved),0) reserved,
        COALESCE(sum(stock_value_minor),0) stock_value,
        count(*) FILTER (WHERE physical-reserved <= 5) low_stock
       FROM stock_balances WHERE shop_id=$1`,
      [shop],
    );
    const [orders] = await db.query(
      `SELECT
        count(*) FILTER (WHERE status IN ('new','confirmed','ready')) open_orders,
        count(*) FILTER (WHERE status='issued' AND COALESCE(issued_at, updated_at) >= $2 AND COALESCE(issued_at, updated_at) < $3) issued_orders,
        COALESCE(sum(total_minor) FILTER (WHERE status='issued' AND COALESCE(issued_at, updated_at) >= $2 AND COALESCE(issued_at, updated_at) < $3),0) issued_total
       FROM online_orders WHERE shop_id=$1`,
      [shop, start, end],
    );
    const [shifts] = await db.query(
      `SELECT
        count(*) closed_shifts,
        COALESCE(sum(actual_cash_minor-expected_cash_minor),0) discrepancy
       FROM cash_shifts WHERE shop_id=$1 AND closed_at >= $2 AND closed_at < $3`,
      [shop, start, end],
    );
    const dailyRows = await db.query(
      `SELECT
        to_char(d.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
        COALESCE(sum(d.total_minor) FILTER (WHERE d.kind='sale'),0) AS sales_minor,
        COALESCE(sum(d.total_minor) FILTER (WHERE d.kind='return'),0) AS returns_minor,
        count(*) FILTER (WHERE d.kind='sale') AS sales_count
       FROM stock_documents d
       WHERE d.shop_id=$1 AND d.created_at >= $2 AND d.created_at < $3 AND d.kind IN ('sale','return')
       GROUP BY 1
       ORDER BY 1 ASC
       LIMIT 31`,
      [shop, start, end],
    );
    const topProductsRows = await db.query(
      `SELECT
        v.id,
        v.name,
        COALESCE(v.category,'') AS category,
        COALESCE(sum(sl.quantity),0) AS quantity_sold,
        COALESCE(sum(sl.quantity * sl.unit_price_minor),0) AS revenue_minor,
        COALESCE(sum(sl.cost_minor),0) AS cost_minor
       FROM sale_lines sl
       JOIN stock_documents d ON d.shop_id=sl.shop_id AND d.id=sl.document_id
       JOIN variants v ON v.shop_id=sl.shop_id AND v.id=sl.variant_id
       WHERE sl.shop_id=$1 AND d.created_at >= $2 AND d.created_at < $3
       GROUP BY v.id, v.name, v.category
       ORDER BY revenue_minor DESC, quantity_sold DESC
       LIMIT 6`,
      [shop, start, end],
    );
    const categoryRows = await db.query(
      `SELECT
        CASE WHEN COALESCE(trim(v.category),'')='' THEN 'Без категории' ELSE v.category END AS category,
        COALESCE(sum(sl.quantity * sl.unit_price_minor),0) AS revenue_minor,
        COALESCE(sum(sl.quantity),0) AS quantity_sold
       FROM sale_lines sl
       JOIN stock_documents d ON d.shop_id=sl.shop_id AND d.id=sl.document_id
       JOIN variants v ON v.shop_id=sl.shop_id AND v.id=sl.variant_id
       WHERE sl.shop_id=$1 AND d.created_at >= $2 AND d.created_at < $3
       GROUP BY 1
       ORDER BY revenue_minor DESC
       LIMIT 6`,
      [shop, start, end],
    );
    const sales = Number(trade.sales),
      returns = Number(trade.returns);
    const cost = Number(trade.sold_cost) - Number(trade.returned_cost);
    const revenue = sales - returns;
    return {
      from: start,
      to: end,
      revenueMinor: revenue,
      salesMinor: sales,
      returnsMinor: returns,
      returnsCount: Number(trade.returns_count),
      posSalesMinor: Number(trade.pos_sales),
      posSalesCount: Number(trade.pos_sales_count),
      onlineSalesMinor: Number(trade.online_sales),
      onlineSalesCount: Number(trade.online_sales_count),
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
      dailySeries: dailyRows.map((r: any) => ({
        day: String(r.day),
        salesMinor: Number(r.sales_minor),
        returnsMinor: Number(r.returns_minor),
        netMinor: Number(r.sales_minor) - Number(r.returns_minor),
        salesCount: Number(r.sales_count),
      })),
      topProducts: topProductsRows.map((r: any) => ({
        id: String(r.id),
        name: String(r.name),
        category: String(r.category),
        quantitySold: Number(r.quantity_sold),
        revenueMinor: Number(r.revenue_minor),
        profitMinor: Number(r.revenue_minor) - Number(r.cost_minor),
      })),
      categoryShare: categoryRows.map((r: any) => ({
        category: String(r.category),
        revenueMinor: Number(r.revenue_minor),
        quantitySold: Number(r.quantity_sold),
      })),
    };
  }

  async export(shop: string, kind: string, from?: string, to?: string) {
    let headers: string[];
    let rows: any[];
    if (kind === 'products') {
      headers = [
        'sku',
        'name',
        'barcode',
        'category',
        'subcategory',
        'sale_price_minor',
        'published',
      ];
      rows = await this.db.query(
        'SELECT sku,name,barcode,category,subcategory,sale_price_minor,published FROM variants WHERE shop_id=$1 ORDER BY name,id',
        [shop],
      );
    } else if (kind === 'stock') {
      headers = [
        'sku',
        'name',
        'barcode',
        'physical',
        'reserved',
        'available',
        'stock_value_minor',
      ];
      rows = await this.db.query(
        `SELECT v.sku,v.name,v.barcode,b.physical,b.reserved,b.physical-b.reserved available,b.stock_value_minor
         FROM stock_balances b JOIN variants v ON v.shop_id=b.shop_id AND v.id=b.variant_id
         WHERE b.shop_id=$1 ORDER BY v.name,v.id`,
        [shop],
      );
    } else if (kind === 'sales') {
      const [start, end] = this.range(from, to);
      headers = [
        'id',
        'created_at',
        'channel',
        'total_minor',
        'payment_kind',
        'payment_method',
        'payment_amount_minor',
      ];
      rows = await this.db.query(
        `SELECT d.id,d.created_at,
                CASE WHEN EXISTS (SELECT 1 FROM online_orders o WHERE o.shop_id=d.shop_id AND o.sale_id=d.id) THEN 'online' ELSE 'pos' END channel,
                d.total_minor,p.kind payment_kind,p.method payment_method,p.amount_minor payment_amount_minor
         FROM stock_documents d LEFT JOIN payment_records p ON p.shop_id=d.shop_id AND p.document_id=d.id
         WHERE d.shop_id=$1 AND d.kind IN ('sale','return') AND d.created_at >= $2 AND d.created_at < $3 ORDER BY d.created_at DESC,d.id`,
        [shop, start, end],
      );
    } else if (kind === 'orders') {
      const [start, end] = this.range(from, to);
      headers = [
        'id',
        'created_at',
        'issued_at',
        'status',
        'name',
        'phone',
        'fulfillment',
        'address',
        'total_minor',
        'sale_id',
      ];
      rows = await this.db.query(
        'SELECT id,created_at,issued_at,status,name,phone,fulfillment,address,total_minor,sale_id FROM online_orders WHERE shop_id=$1 AND created_at >= $2 AND created_at < $3 ORDER BY created_at DESC,id',
        [shop, start, end],
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
