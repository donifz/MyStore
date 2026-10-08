import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';

@Injectable()
export class NotificationsService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  async list(shop: string, limit = 50) {
    const rows = await this.db.query(
      'SELECT id,kind,title,body,entity_id,created_at,read_at FROM notifications WHERE shop_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2',
      [shop, Math.min(Math.max(limit, 1), 100)],
    );
    return rows.map((r: any) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      entityId: r.entity_id,
      createdAt: r.created_at.toISOString(),
      readAt: r.read_at?.toISOString() ?? null,
    }));
  }

  async read(shop: string, id: string) {
    const [[row]] = await this.db.query(
      'UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE shop_id=$1 AND id=$2 RETURNING id,read_at',
      [shop, id],
    );
    return row ? { id: row.id, readAt: row.read_at.toISOString() } : null;
  }

  async audit(shop: string, limit = 100) {
    const rows = await this.db.query(
      'SELECT id,actor_id,action,entity_type,entity_id,details,created_at FROM audit_log WHERE shop_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2',
      [shop, Math.min(Math.max(limit, 1), 200)],
    );
    return rows.map((r: any) => ({
      id: Number(r.id),
      actorId: r.actor_id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: r.details,
      createdAt: r.created_at.toISOString(),
    }));
  }
}
