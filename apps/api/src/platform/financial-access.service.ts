import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { DATABASE } from '../database';
import { accessOperation } from '../auth/access-operations';
import { StaffService } from '../staff/staff.service';
import { ReportsService } from '../reports/reports.service';

const fields = `g.id,g.shop_id AS "shopId",s.name AS "shopName",u.email AS "adminEmail",g.purpose,g.created_at AS "createdAt",g.expires_at AS "expiresAt",g.revoked_at AS "revokedAt",(g.revoked_at IS NULL AND g.expires_at>clock_timestamp()) AS active`;
const joins =
  ' FROM platform_financial_grants g JOIN shops s ON s.id=g.shop_id JOIN users u ON u.id=g.admin_user_id';
@Injectable()
export class FinancialAccessService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly staff: StaffService,
    private readonly reports: ReportsService,
  ) {}
  async admin(tx: EntityManager, actor: string) {
    const [row] = await tx.query(
      'SELECT user_id FROM platform_admins WHERE user_id=$1 FOR SHARE',
      [actor],
    );
    if (!row) throw new ForbiddenException();
  }
  async list(shop: string, actor: string) {
    return this.db.transaction(async (tx) => {
      await this.staff.owner(tx, shop, actor);
      return {
        items: await tx.query(
          'SELECT ' +
            fields +
            joins +
            ' WHERE g.shop_id=$1 ORDER BY g.created_at DESC,g.id LIMIT 100',
          [shop],
        ),
      };
    });
  }
  async mine(actor: string) {
    return this.db.transaction(async (tx) => {
      await this.admin(tx, actor);
      return {
        items: await tx.query(
          'SELECT ' +
            fields +
            joins +
            ' WHERE g.admin_user_id=$1 ORDER BY g.created_at DESC,g.id LIMIT 100',
          [actor],
        ),
      };
    });
  }
  async audit(
    tx: EntityManager,
    shop: string,
    actor: string,
    action: string,
    id: string,
    details: object,
  ) {
    await tx.query(
      "INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,'platform_financial_grant',$4,$5)",
      [shop, actor, 'platform-access:' + action, id, JSON.stringify(details)],
    );
  }
  async grant(
    shop: string,
    actor: string,
    input: { adminEmail: string; purpose: string; durationHours: number },
    key: string,
  ) {
    const email = input.adminEmail.trim().toLowerCase(),
      purpose = input.purpose.trim();
    if (!purpose || /[\x00-\x1f\x7f]/.test(purpose))
      throw new BadRequestException('Purpose required');
    return this.db.transaction(async (tx) => {
      await this.staff.owner(tx, shop, actor);
      return accessOperation(
        tx,
        'platform-access:' + shop.toLowerCase(),
        key,
        {
          actor,
          kind: 'grant',
          email,
          purpose,
          durationHours: input.durationHours,
        },
        async () => {
          const [target] = await tx.query(
            'SELECT p.user_id FROM platform_admins p JOIN users u ON u.id=p.user_id WHERE u.email=$1 FOR SHARE OF p',
            [email],
          );
          if (!target)
            throw new BadRequestException('Administrator unavailable');
          if (target.user_id === actor)
            throw new ForbiddenException('Self grant forbidden');
          const id = randomUUID();
          const [grant] = await tx.query(
            'INSERT INTO platform_financial_grants(id,shop_id,admin_user_id,granted_by,purpose,expires_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()+make_interval(hours=>$6)) RETURNING id,expires_at AS "expiresAt"',
            [id, shop, target.user_id, actor, purpose, input.durationHours],
          );
          await this.audit(tx, shop, actor, 'grant', id, {
            adminUserId: target.user_id,
            purpose,
            expiresAt: grant.expiresAt,
          });
          return grant;
        },
      );
    });
  }
  async revoke(shop: string, actor: string, id: string, key: string) {
    id = id.toLowerCase();
    return this.db.transaction(async (tx) => {
      await this.staff.owner(tx, shop, actor);
      return accessOperation(
        tx,
        'platform-access:' + shop.toLowerCase(),
        key,
        { actor, kind: 'revoke', id },
        async () => {
          const [row] = await tx.query(
            'SELECT * FROM platform_financial_grants WHERE shop_id=$1 AND id=$2 FOR UPDATE',
            [shop, id],
          );
          if (!row) throw new NotFoundException();
          if (!row.revoked_at) {
            await tx.query(
              'UPDATE platform_financial_grants SET revoked_at=clock_timestamp(),revoked_by=$2 WHERE id=$1',
              [id, actor],
            );
            await this.audit(tx, shop, actor, 'revoke', id, {
              adminUserId: row.admin_user_id,
              purpose: row.purpose,
            });
          }
          return { revoked: true };
        },
      );
    });
  }
  async summary(actor: string, id: string) {
    return this.db.transaction(async (tx) => {
      const [lookup] = await tx.query(
        'SELECT shop_id FROM platform_financial_grants WHERE id=$1 AND admin_user_id=$2',
        [id, actor],
      );
      if (!lookup) throw new ForbiddenException();
      await tx.query('SELECT id FROM shops WHERE id=$1 FOR SHARE', [
        lookup.shop_id,
      ]);
      await this.admin(tx, actor);
      const [grant] = await tx.query(
        'SELECT * FROM platform_financial_grants WHERE id=$1 AND admin_user_id=$2 FOR SHARE',
        [id, actor],
      );
      const [time] = await tx.query('SELECT clock_timestamp() current_time');
      if (!grant || grant.revoked_at || grant.expires_at <= time.current_time)
        throw new ForbiddenException();
      const summary = await this.reports.summary(
        grant.shop_id,
        undefined,
        undefined,
        tx,
      );
      await this.audit(tx, grant.shop_id, actor, 'read', id, {
        purpose: grant.purpose,
      });
      return summary;
    });
  }
}
