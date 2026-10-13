import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
import { EmailQueueService, validRecipient } from './email-queue.service';
const statuses: Record<string, string> = {
  new: 'Новый заказ',
  confirmed: 'Подтверждён',
  ready: 'Готов к выдаче',
  issued: 'Выдан',
  cancelled: 'Отменён',
  expired: 'Срок подтверждения истёк',
  approved: 'Одобрено',
  rejected: 'Отклонено',
};
@Injectable()
export class EventEmailService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly queue: EmailQueueService,
  ) {}
  async expandBatch() {
    return this.db.transaction(async (tx) => {
      const events = await tx.query(
        "SELECT * FROM outbox_events WHERE email_dispatch_enabled AND email_expanded_at IS NULL AND topic IN ('order.status','product.moderation') ORDER BY created_at,id LIMIT 20 FOR UPDATE SKIP LOCKED",
      );
      for (const e of events) {
        const status = e.payload.status;
        if (!statuses[status]) {
          await tx.query(
            "UPDATE outbox_events SET email_dispatch_enabled=false,last_error='Unsupported email event status' WHERE id=$1",
            [e.id],
          );
          continue;
        }
        const [shop] = await tx.query('SELECT name FROM shops WHERE id=$1', [
          e.shop_id,
        ]);
        if (!shop) {
          await tx.query(
            "UPDATE outbox_events SET email_dispatch_enabled=false,last_error='Shop unavailable for email' WHERE id=$1",
            [e.id],
          );
          continue;
        }
        const recipients = new Set<string>();
        let subject = '',
          text = '';
        if (e.topic === 'order.status') {
          const [order] = await tx.query(
            'SELECT email FROM online_orders WHERE shop_id=$1 AND id=$2',
            [e.shop_id, e.entity_id],
          );
          if (!order) {
            await tx.query(
              "UPDATE outbox_events SET email_dispatch_enabled=false,last_error='Order unavailable for email' WHERE id=$1",
              [e.id],
            );
            continue;
          }
          if (order.email) recipients.add(order.email);
          if (status === 'new') {
            const members = await tx.query(
              "SELECT u.email FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN email_preferences p ON p.shop_id=m.shop_id AND p.user_id=m.user_id WHERE m.shop_id=$1 AND m.role IN ('owner','manager') AND COALESCE(p.orders,true)",
              [e.shop_id],
            );
            for (const m of members) recipients.add(m.email);
          }
          subject = `MyStore: ${statuses[status]}`;
          text = `Магазин: ${shop.name}\nЗаказ: ${e.entity_id}\nСтатус: ${statuses[status]}`;
        } else {
          const members = await tx.query(
            "SELECT u.email FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN email_preferences p ON p.shop_id=m.shop_id AND p.user_id=m.user_id WHERE m.shop_id=$1 AND m.role='owner' AND COALESCE(p.moderation,true)",
            [e.shop_id],
          );
          for (const m of members) recipients.add(m.email);
          const [revision] = e.payload.revisionId
            ? await tx.query(
                'SELECT name,reason FROM product_publication_revisions WHERE id::text=$1 AND shop_id=$2',
                [e.payload.revisionId, e.shop_id],
              )
            : [];
          subject = `MyStore: модерация — ${statuses[status]}`;
          text = `Магазин: ${shop.name}\nТовар: ${revision?.name || e.entity_id || 'Карточка товара'}\nРезультат: ${statuses[status]}${status === 'rejected' && revision?.reason ? '\nПричина: ' + revision.reason : ''}`;
        }
        let invalid = false;
        for (const to of recipients) {
          if (!validRecipient(to)) {
            invalid = true;
            continue;
          }
          await this.queue.enqueue(
            tx,
            'event:' + e.id + ':' + to,
            { to, subject, text },
            e.shop_id,
          );
        }
        await tx.query(
          'UPDATE outbox_events SET email_expanded_at=now(),last_error=$2 WHERE id=$1',
          [e.id, invalid ? 'Invalid recipient skipped' : null],
        );
      }
      return events.length;
    });
  }
}
