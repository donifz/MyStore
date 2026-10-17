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
    const [summary] = await this.db.query(`SELECT
      (SELECT count(*) FROM shops) shop_count,
      (SELECT count(*) FROM partner_applications WHERE status IN ('new','in_review')) pending_partners,
      (SELECT count(*) FROM product_publication_revisions WHERE status='pending') pending_products`);
    const shops = await this.db.query(
      'SELECT id,name,city,published FROM shops ORDER BY name,id LIMIT 25',
    );
    return {
      shopCount: Number(summary.shop_count),
      pendingPartners: Number(summary.pending_partners),
      pendingProducts: Number(summary.pending_products),
      shops,
    };
  }
}
