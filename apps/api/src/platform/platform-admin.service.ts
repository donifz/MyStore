import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';

@Injectable()
export class PlatformAdminService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  async requireAdmin(userId: string): Promise<void> {
    const [admin] = await this.db.query(
      'SELECT 1 FROM platform_admins WHERE user_id=$1',
      [userId],
    );
    if (!admin) throw new ForbiddenException();
  }
  async overview() {
    const [summary] = await this.db.query(
      `SELECT
        (SELECT count(*) FROM shops) shop_count,
        (SELECT count(*) FROM cash_shifts WHERE closed_at IS NULL) open_shifts,
        (SELECT count(*) FROM partner_applications WHERE status IN ('new','in_review')) pending_partners,
        (SELECT count(*) FROM product_publication_revisions WHERE status='pending') pending_products,
        COALESCE((SELECT sum(CASE WHEN kind='sale' THEN amount_minor ELSE -amount_minor END)
          FROM payment_records WHERE created_at >= current_date
          AND created_at < current_date + interval '1 day'),0) today_sales_minor`,
    );
    const sales = await this.db.query(
      `SELECT to_char(d.business_day,'YYYY-MM-DD') date_label,
        COALESCE(sum(CASE WHEN p.kind='sale' THEN p.amount_minor ELSE -p.amount_minor END),0) total_minor
        FROM generate_series(current_date - interval '6 days', current_date, interval '1 day') d(business_day)
        LEFT JOIN payment_records p ON p.created_at >= d.business_day
          AND p.created_at < d.business_day + interval '1 day'
        GROUP BY d.business_day ORDER BY d.business_day`,
    );
    const categories = await this.db.query(
      `SELECT COALESCE(NULLIF(trim(v.category),''),'Без категории') name,
        sum(sl.quantity * sl.unit_price_minor) total_minor
        FROM sale_lines sl
        JOIN stock_documents d ON d.shop_id=sl.shop_id AND d.id=sl.document_id
        JOIN variants v ON v.shop_id=sl.shop_id AND v.id=sl.variant_id
        WHERE d.created_at >= current_date - interval '6 days'
        GROUP BY 1 ORDER BY total_minor DESC,name LIMIT 5`,
    );
    const shops = await this.db.query(
      `SELECT s.id,s.name,u.email owner_email,
        COALESCE(b.units,0) units,
        sh.opened_at last_shift_at,
        EXISTS(SELECT 1 FROM cash_shifts c WHERE c.shop_id=s.id AND c.closed_at IS NULL) shift_open
       FROM shops s
       LEFT JOIN LATERAL (
         SELECT users.email FROM memberships m JOIN users ON users.id=m.user_id
         WHERE m.shop_id=s.id AND m.role='owner' ORDER BY users.email LIMIT 1
       ) u ON true
       LEFT JOIN LATERAL (
         SELECT sum(physical) units FROM stock_balances WHERE shop_id=s.id
       ) b ON true
       LEFT JOIN LATERAL (
         SELECT opened_at FROM cash_shifts WHERE shop_id=s.id ORDER BY opened_at DESC LIMIT 1
       ) sh ON true
       ORDER BY s.name,s.id LIMIT 25`,
    );
    return {
      shopCount: Number(summary.shop_count),
      openShifts: Number(summary.open_shifts),
      pendingPartners: Number(summary.pending_partners),
      pendingProducts: Number(summary.pending_products),
      todaySalesMinor: Number(summary.today_sales_minor),
      sales: sales.map((row: any) => ({
        day: row.date_label,
        totalMinor: Number(row.total_minor),
      })),
      categories: categories.map((row: any) => ({
        name: row.name,
        totalMinor: Number(row.total_minor),
      })),
      shops: shops.map((row: any) => ({
        id: row.id,
        name: row.name,
        ownerEmail: row.owner_email,
        units: Number(row.units),
        shiftOpen: row.shift_open,
        lastShiftAt: row.last_shift_at,
      })),
    };
  }
}
