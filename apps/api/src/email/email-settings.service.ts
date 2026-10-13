import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DATABASE } from '../database';
import { StaffService } from '../staff/staff.service';
import { accessOperation } from '../auth/access-operations';
import { EmailQueueService } from './email-queue.service';
import { readEmailConfig } from './email-config';
@Injectable()
export class EmailSettingsService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly staff: StaffService,
    private readonly queue: EmailQueueService,
  ) {}
  async member(tx: EntityManager, shop: string, user: string) {
    const [row] = await tx.query(
      'SELECT role FROM memberships WHERE shop_id=$1 AND user_id=$2',
      [shop, user],
    );
    if (!row) throw new ForbiddenException();
  }
  async status(shop: string, user: string) {
    return this.db.transaction(async (tx) => {
      await this.staff.owner(tx, shop, user);
      let configured = false;
      try {
        configured = readEmailConfig().enabled;
      } catch {}
      return {
        enabled: process.env.EMAIL_ENABLED === 'true',
        configured,
        provider: process.env.EMAIL_PROVIDER || 'smtp',
        mode: process.env.EMAIL_WORKER_MODE || 'separate',
        deliveries: await tx.query(
          "SELECT id,recipient,status,attempts,available_at,created_at,sent_at,last_error,(status='failed' AND secret_kind IS NULL AND payload IS NOT NULL) AS retryable FROM email_deliveries WHERE shop_id=$1 ORDER BY created_at DESC,id LIMIT 50",
          [shop],
        ),
      };
    });
  }
  async preferences(shop: string, user: string) {
    return this.db.transaction(async (tx) => {
      await this.member(tx, shop, user);
      const [row] = await tx.query(
        'SELECT orders,moderation FROM email_preferences WHERE shop_id=$1 AND user_id=$2',
        [shop, user],
      );
      return row || { orders: true, moderation: true };
    });
  }
  async save(
    shop: string,
    user: string,
    orders: boolean,
    moderation: boolean,
    key: string,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM shops WHERE id=$1 FOR UPDATE', [shop]);
      await this.member(tx, shop, user);
      return accessOperation(
        tx,
        'email-pref:' + shop + ':' + user,
        key,
        { orders, moderation },
        async () => {
          await tx.query(
            'INSERT INTO email_preferences(shop_id,user_id,orders,moderation) VALUES($1,$2,$3,$4) ON CONFLICT(shop_id,user_id) DO UPDATE SET orders=excluded.orders,moderation=excluded.moderation',
            [shop, user, orders, moderation],
          );
          return { orders, moderation };
        },
      );
    });
  }
  async retry(shop: string, user: string, id: string, key: string) {
    return this.db.transaction(async (tx) => {
      await this.staff.owner(tx, shop, user);
      return accessOperation(
        tx,
        'email-retry:' + shop,
        key,
        { user, id },
        async () => {
          const [row] = await tx.query(
            'SELECT * FROM email_deliveries WHERE shop_id=$1 AND id=$2 FOR UPDATE',
            [shop, id],
          );
          if (!row) throw new NotFoundException();
          if (row.status !== 'failed' || row.secret_kind || !row.payload)
            throw new ConflictException(
              'Delivery cannot be retried; issue a new invitation',
            );
          await tx.query(
            "UPDATE email_deliveries SET status='pending',attempts=0,available_at=now(),last_error=NULL WHERE id=$1",
            [id],
          );
          await tx.query(
            "INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'email:retry','email_delivery',$3)",
            [shop, user, id],
          );
          return { queued: true };
        },
      );
    });
  }
}
