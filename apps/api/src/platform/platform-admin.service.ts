import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
      `SELECT id, name, city, published,
              marketplace_blocked AS "marketplaceBlocked",
              marketplace_block_reason AS "marketplaceBlockReason",
              subscription_until AS "subscriptionUntil"
       FROM shops ORDER BY name, id LIMIT 100`,
    );
    return {
      shopCount: Number(summary.shop_count),
      pendingPartners: Number(summary.pending_partners),
      pendingProducts: Number(summary.pending_products),
      shops,
    };
  }

  async setMarketplaceBlocked(
    adminId: string,
    shopId: string,
    blocked: boolean,
    reason?: string,
  ) {
    const [shop] = await this.db.query(
      'SELECT id, name FROM shops WHERE id=$1',
      [shopId],
    );
    if (!shop) throw new NotFoundException('Shop not found');

    const trimmedReason = reason?.trim() || null;
    if (blocked && !trimmedReason) {
      throw new BadRequestException('Reason required for blocking marketplace');
    }

    const [[updated]] = await this.db.query(
      'UPDATE shops SET marketplace_blocked=$2, marketplace_block_reason=$3 WHERE id=$1 RETURNING *',
      [shopId, blocked, blocked ? trimmedReason : null],
    );

    await this.db.query(
      `INSERT INTO audit_log(shop_id, actor_id, action, entity_type, entity_id, details)
       VALUES($1, $2, $3, 'shop_marketplace', $1, $4)`,
      [
        shopId,
        adminId,
        blocked ? 'marketplace:block' : 'marketplace:unblock',
        JSON.stringify({ blocked, reason: trimmedReason }),
      ],
    );

    return {
      id: updated.id,
      name: updated.name,
      marketplaceBlocked: updated.marketplace_blocked,
      marketplaceBlockReason: updated.marketplace_block_reason,
      subscriptionUntil: updated.subscription_until,
    };
  }

  async setSubscription(adminId: string, shopId: string, until: string | null) {
    const [shop] = await this.db.query(
      'SELECT id, name FROM shops WHERE id=$1',
      [shopId],
    );
    if (!shop) throw new NotFoundException('Shop not found');

    let untilIso: string | null = null;
    if (until) {
      const parsed = new Date(until);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid subscription date');
      }
      untilIso = parsed.toISOString();
    }

    const [[updated]] = await this.db.query(
      'UPDATE shops SET subscription_until=$2 WHERE id=$1 RETURNING *',
      [shopId, untilIso],
    );

    await this.db.query(
      `INSERT INTO audit_log(shop_id, actor_id, action, entity_type, entity_id, details)
       VALUES($1, $2, 'subscription:update', 'shop_subscription', $1, $3)`,
      [shopId, adminId, JSON.stringify({ subscriptionUntil: untilIso })],
    );

    return {
      id: updated.id,
      name: updated.name,
      marketplaceBlocked: updated.marketplace_blocked,
      marketplaceBlockReason: updated.marketplace_block_reason,
      subscriptionUntil: updated.subscription_until,
    };
  }
}
