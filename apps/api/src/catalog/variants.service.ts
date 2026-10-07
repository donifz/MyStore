import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID, randomBytes } from 'node:crypto';
import { DATABASE } from '../database';
export type VariantInput = {
  name: string;
  barcode?: string;
  salePriceMinor: number;
};
export type Variant = {
  description: string;
  category: string;
  published: boolean;
  id: string;
  name: string;
  barcode: string;
  salePriceMinor: number;
};
@Injectable()
export class VariantsService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}
  private dto(row: any): Variant {
    return {
      id: row.id,
      name: row.name,
      barcode: row.barcode,
      salePriceMinor: Number(row.sale_price_minor),
      description: row.description,
      category: row.category,
      published: row.published,
    };
  }
  async list(
    shopId: string,
    q: string,
    page: number,
    pageSize: number,
    showCost: boolean,
  ) {
    const pattern = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
    const filter = 'v.shop_id=$1 AND (v.name ILIKE $2 OR v.barcode ILIKE $2)';
    const [count] = await this.db.query(
      'SELECT count(*) FROM variants v WHERE ' + filter,
      [shopId, pattern],
    );
    const rows = await this.db.query(
      'SELECT v.id,v.name,v.barcode,v.sale_price_minor,COALESCE(b.physical,0) physical,COALESCE(b.reserved,0) reserved,COALESCE(b.stock_value_minor,0) stock_value_minor FROM variants v LEFT JOIN stock_balances b ON b.shop_id=v.shop_id AND b.variant_id=v.id WHERE ' +
        filter +
        ' ORDER BY v.name,v.id LIMIT $3 OFFSET $4',
      [shopId, pattern, pageSize, (page - 1) * pageSize],
    );
    return {
      items: rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        barcode: r.barcode,
        salePriceMinor: Number(r.sale_price_minor),
        physical: Number(r.physical),
        reserved: Number(r.reserved),
        available: Number(r.physical) - Number(r.reserved),
        ...(showCost ? { stockValueMinor: Number(r.stock_value_minor) } : {}),
      })),
      total: Number(count.count),
      page,
      pageSize,
    };
  }
  async createVariant(shopId: string, input: VariantInput): Promise<Variant> {
    const barcode =
      input.barcode ?? `MS${randomBytes(12).toString('hex').toUpperCase()}`;
    try {
      const [row] = await this.db.query(
        'INSERT INTO variants(id,shop_id,name,barcode,sale_price_minor)VALUES($1,$2,$3,$4,$5)RETURNING *',
        [
          randomUUID(),
          shopId,
          input.name.trim(),
          barcode,
          input.salePriceMinor,
        ],
      );
      return this.dto(row);
    } catch (e: any) {
      if (e.code === '23505')
        throw new ConflictException('Barcode already exists');
      throw e;
    }
  }
  async findByBarcode(
    shopId: string,
    barcode: string,
  ): Promise<Variant | null> {
    const [row] = await this.db.query(
      'SELECT id,name,barcode,sale_price_minor,description,category,published FROM variants WHERE shop_id=$1 AND barcode=$2',
      [shopId, barcode],
    );
    return row ? this.dto(row) : null;
  }
  async updateVariant(
    shopId: string,
    id: string,
    input: {
      name: string;
      salePriceMinor: number;
      description: string;
      category: string;
      published: boolean;
    },
  ) {
    const [row] = await this.db.query(
      'UPDATE variants SET name=$3,sale_price_minor=$4,description=$5,category=$6,published=$7 WHERE shop_id=$1 AND id=$2 RETURNING *',
      [
        shopId,
        id,
        input.name.trim(),
        input.salePriceMinor,
        input.description.trim(),
        input.category.trim(),
        input.published,
      ],
    );
    if (!row) throw new NotFoundException();
    return this.dto(row);
  }
  async getById(shopId: string, id: string) {
    const [row] = await this.db.query(
      'SELECT id,name,barcode,sale_price_minor,description,category,published FROM variants WHERE shop_id=$1 AND id=$2',
      [shopId, id],
    );
    if (!row) throw new NotFoundException();
    return this.dto(row);
  }
}
