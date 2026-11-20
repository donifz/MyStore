import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
@Injectable()
export class SalesHistoryService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}
  async list(
    shopId: string,
    actorId: string,
    owner: boolean,
    page: number,
    pageSize: number,
    sort = 'newest',
    method?: 'cash' | 'card',
    filters: {
      q?: string;
      from?: string;
      to?: string;
      status?: 'all' | 'returned' | 'credit';
    } = {},
  ) {
    const args: unknown[] = [shopId, owner, actorId];
    const clauses: string[] = [
      "d.shop_id=$1 AND d.kind='sale' AND ($2::boolean OR d.actor_id=$3)",
    ];
    if (method) {
      args.push(method);
      clauses.push(
        `EXISTS (SELECT 1 FROM payment_records pr WHERE pr.shop_id=d.shop_id AND pr.document_id=d.id AND pr.kind='sale' AND pr.method=$${args.length})`,
      );
    }
    const rawQ = (filters.q ?? '').trim();
    if (rawQ) {
      const cleanQ = rawQ.replace(/^#/, '');
      const pattern = '%' + cleanQ.replace(/[\\%_]/g, '\\$&') + '%';
      args.push(pattern);
      const pIdx = args.length;
      clauses.push(
        `(d.id::text ILIKE $${pIdx} OR EXISTS (SELECT 1 FROM sale_lines sl WHERE sl.shop_id=d.shop_id AND sl.document_id=d.id AND (sl.name ILIKE $${pIdx} OR sl.barcode ILIKE $${pIdx})))`,
      );
    }
    if (filters.from) {
      const fromIso = /^\d{4}-\d{2}-\d{2}$/.test(filters.from)
        ? `${filters.from}T00:00:00+06:00`
        : filters.from;
      const fromDate = new Date(fromIso);
      if (!Number.isNaN(fromDate.getTime())) {
        args.push(fromDate.toISOString());
        clauses.push(`d.created_at >= $${args.length}`);
      }
    }
    if (filters.to) {
      const toIso = /^\d{4}-\d{2}-\d{2}$/.test(filters.to)
        ? `${filters.to}T23:59:59.999+06:00`
        : filters.to;
      const toDate = new Date(toIso);
      if (!Number.isNaN(toDate.getTime())) {
        args.push(toDate.toISOString());
        clauses.push(`d.created_at <= $${args.length}`);
      }
    }
    if (filters.status === 'returned') {
      clauses.push(
        'EXISTS (SELECT 1 FROM return_lines rl JOIN sale_lines sl ON sl.shop_id=rl.shop_id AND sl.id=rl.sale_line_id WHERE sl.shop_id=d.shop_id AND sl.document_id=d.id)',
      );
    } else if (filters.status === 'credit') {
      clauses.push(
        'EXISTS (SELECT 1 FROM credit_sales cs WHERE cs.shop_id=d.shop_id AND cs.document_id=d.id)',
      );
    }
    const where = clauses.join(' AND ');
    const orderBy =
      sort === 'oldest'
        ? 'd.created_at ASC,d.id ASC'
        : sort === 'total-asc'
          ? 'd.total_minor ASC,d.created_at DESC,d.id'
          : sort === 'total-desc'
            ? 'd.total_minor DESC,d.created_at DESC,d.id'
            : 'd.created_at DESC,d.id';
    const [count] = await this.db.query(
      'SELECT count(*) FROM stock_documents d WHERE ' + where,
      args,
    );
    const rows = await this.db.query(
      'SELECT d.id,d.total_minor,d.created_at,p.shift_id,r.method,' +
        'EXISTS (SELECT 1 FROM return_lines rl JOIN sale_lines sl ON sl.shop_id=rl.shop_id AND sl.id=rl.sale_line_id WHERE sl.shop_id=d.shop_id AND sl.document_id=d.id) has_returns,' +
        'EXISTS (SELECT 1 FROM credit_sales cs WHERE cs.shop_id=d.shop_id AND cs.document_id=d.id) is_credit ' +
        "FROM stock_documents d LEFT JOIN pos_sales p ON p.shop_id=d.shop_id AND p.document_id=d.id LEFT JOIN payment_records r ON r.shop_id=d.shop_id AND r.document_id=d.id AND r.kind='sale' WHERE " +
        where +
        ` ORDER BY ${orderBy} LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
      [...args, pageSize, (page - 1) * pageSize],
    );
    return {
      items: rows.map((r: any) => ({
        id: r.id,
        totalMinor: Number(r.total_minor),
        createdAt: r.created_at.toISOString(),
        shiftId: r.shift_id ?? null,
        method: r.method ?? null,
        hasReturns: Boolean(r.has_returns),
        isCredit: Boolean(r.is_credit),
      })),
      total: Number(count.count),
      page,
      pageSize,
    };
  }
  async detail(shopId: string, id: string, actorId: string, owner: boolean) {
    const [d] = await this.db.query(
      "SELECT d.*,p.shift_id,r.method FROM stock_documents d LEFT JOIN pos_sales p ON p.shop_id=d.shop_id AND p.document_id=d.id LEFT JOIN payment_records r ON r.shop_id=d.shop_id AND r.document_id=d.id AND r.kind='sale' WHERE d.shop_id=$1 AND d.id=$2 AND d.kind='sale'",
      [shopId, id],
    );
    if (!d) throw new NotFoundException();
    if (!owner && d.actor_id !== actorId) throw new ForbiddenException();
    const rows = await this.db.query(
      'SELECT s.*,COALESCE((SELECT sum(r.quantity) FROM return_lines r WHERE r.shop_id=s.shop_id AND r.sale_line_id=s.id),0) returned_quantity FROM sale_lines s WHERE s.shop_id=$1 AND s.document_id=$2 ORDER BY s.id',
      [shopId, id],
    );
    return {
      id: d.id,
      totalMinor: Number(d.total_minor),
      createdAt: d.created_at.toISOString(),
      shiftId: d.shift_id ?? null,
      method: d.method ?? null,
      lines: rows.map((r: any) => ({
        id: r.id,
        variantId: r.variant_id,
        name: r.name,
        barcode: r.barcode,
        quantity: Number(r.quantity),
        returnedQuantity: Number(r.returned_quantity),
        unitPriceMinor: Number(r.unit_price_minor),
        discountMinor: Number(r.discount_minor || 0),
        discountReason: r.discount_reason ?? null,
      })),
    };
  }
}
