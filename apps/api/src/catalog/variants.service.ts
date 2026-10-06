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
      'SELECT id,name,barcode,sale_price_minor FROM variants WHERE shop_id=$1 AND barcode=$2',
      [shopId, barcode],
    );
    return row ? this.dto(row) : null;
  }
  async getById(shopId: string, id: string) {
    const [row] = await this.db.query(
      'SELECT id,name,barcode,sale_price_minor FROM variants WHERE shop_id=$1 AND id=$2',
      [shopId, id],
    );
    if (!row) throw new NotFoundException();
    return this.dto(row);
  }
}
