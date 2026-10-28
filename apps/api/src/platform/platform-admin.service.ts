import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
import { hashPassword } from '../auth/password';

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
              subscription_until AS "subscriptionUntil",
              EXISTS (
                SELECT 1 FROM memberships m
                WHERE m.shop_id=shops.id AND m.role='owner'
              ) AS "hasOwner",
              (SELECT a.email FROM partner_applications a
               WHERE a.shop_id=shops.id AND a.status='approved') AS "ownerCandidateEmail"
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

  async resetOwnerPassword(
    adminId: string,
    shopId: string,
    ownerEmail?: string,
  ) {
    const temporaryPassword = randomBytes(24).toString('base64url');
    const passwordHash = await hashPassword(temporaryPassword);
    try {
      return await this.db.transaction(async (tx) => {
        const [shop] = await tx.query(
          'SELECT id,name FROM shops WHERE id=$1 FOR UPDATE',
          [shopId],
        );
        if (!shop) throw new NotFoundException('Shop not found');
        const [owner] = await tx.query(
          `SELECT u.id AS "userId", u.email
         FROM memberships m
         JOIN users u ON u.id=m.user_id
         WHERE m.shop_id=$1 AND m.role='owner'
         ORDER BY u.id
         LIMIT 1
         FOR UPDATE OF u`,
          [shopId],
        );
        let userId: string;
        let email: string;
        if (owner) {
          userId = owner.userId;
          email = owner.email;
          await tx.query('UPDATE users SET password_hash=$2 WHERE id=$1', [
            userId,
            passwordHash,
          ]);
          await tx.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
        } else {
          email = ownerEmail?.trim().toLowerCase() ?? '';
          if (!email) throw new BadRequestException('Owner email required');
          const [existing] = await tx.query(
            'SELECT 1 FROM users WHERE email=$1',
            [email],
          );
          if (existing)
            throw new ConflictException(
              'An account with this email already exists',
            );
          userId = randomUUID();
          await tx.query(
            'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',
            [userId, email, passwordHash],
          );
          await tx.query(
            "INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,'owner')",
            [shopId, userId],
          );
          await tx.query(
            `UPDATE partner_invitations i SET used_at=now()
           FROM partner_applications a
           WHERE i.application_id=a.id AND a.shop_id=$1 AND i.used_at IS NULL`,
            [shopId],
          );
        }
        await tx.query(
          `INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details)
         VALUES($1,$2,'platform:owner-password-reset','shop_owner',$3,$4)`,
          [shopId, adminId, userId, JSON.stringify({ email, created: !owner })],
        );
        return {
          shopId,
          shopName: shop.name,
          email,
          temporaryPassword,
        };
      });
    } catch (error: any) {
      if (error.code === '23505')
        throw new ConflictException(
          'An account with this email already exists',
        );
      throw error;
    }
  }
}
