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
  ) {
    const where =
      "d.shop_id=$1 AND d.kind='sale' AND ($2::boolean OR d.actor_id=$3)";
    const args = [shopId, owner, actorId];
    const [count] = await this.db.query(
      'SELECT count(*) FROM stock_documents d WHERE ' + where,
      args,
    );
    const rows = await this.db.query(
      "SELECT d.id,d.total_minor,d.created_at,p.shift_id,r.method FROM stock_documents d LEFT JOIN pos_sales p ON p.shop_id=d.shop_id AND p.document_id=d.id LEFT JOIN payment_records r ON r.shop_id=d.shop_id AND r.document_id=d.id AND r.kind='sale' WHERE " +
        where +
        ' ORDER BY d.created_at DESC,d.id LIMIT $4 OFFSET $5',
      [...args, pageSize, (page - 1) * pageSize],
    );
    return {
      items: rows.map((r: any) => ({
        id: r.id,
        totalMinor: Number(r.total_minor),
        createdAt: r.created_at.toISOString(),
        shiftId: r.shift_id ?? null,
        method: r.method ?? null,
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
