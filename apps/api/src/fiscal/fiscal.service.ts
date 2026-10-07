import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';

@Injectable()
export class FiscalService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  status() {
    const provider = (process.env.KKM_PROVIDER || '').trim();
    return {
      configured: Boolean(provider),
      provider: provider || null,
      productionReady: false,
      message: provider
        ? 'Provider adapter is configured but must pass fiscal acceptance testing before production.'
        : 'KKM provider is not selected. Sales are not fiscalized by MyStore.',
    };
  }

  async receipt(shop: string, sale: string) {
    const [row] = await this.db.query(
      'SELECT provider,status,external_id,fiscal_number,error,created_at,updated_at FROM fiscal_receipts WHERE shop_id=$1 AND sale_id=$2',
      [shop, sale],
    );
    return row
      ? {
          provider: row.provider,
          status: row.status,
          externalId: row.external_id,
          fiscalNumber: row.fiscal_number,
          error: row.error,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
        }
      : null;
  }

  async request(shop: string, sale: string, actor: string) {
    const provider = (process.env.KKM_PROVIDER || '').trim();
    if (!provider) throw new ConflictException('KKM provider not configured');
    if (process.env.NODE_ENV === 'production')
      throw new ConflictException(
        'KKM adapter is not certified for production yet',
      );
    const [document] = await this.db.query(
      "SELECT id FROM stock_documents WHERE shop_id=$1 AND id=$2 AND kind='sale'",
      [shop, sale],
    );
    if (!document) throw new NotFoundException('Sale not found');
    const [[row]] = await this.db.query(
      `INSERT INTO fiscal_receipts(shop_id,sale_id,provider,status,requested_by)
       VALUES($1,$2,$3,'pending',$4)
       ON CONFLICT(shop_id,sale_id) DO UPDATE SET updated_at=now()
       RETURNING provider,status,created_at,updated_at`,
      [shop, sale, provider, actor],
    );
    return {
      provider: row.provider,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
