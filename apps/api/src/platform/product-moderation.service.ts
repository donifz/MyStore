import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';

@Injectable()
export class ProductModerationService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  async list(page: number, pageSize: number) {
    const [count] = await this.db.query(
      "SELECT count(*)::int total FROM product_publication_revisions WHERE status='pending'",
    );
    const items = await this.db.query(
      `SELECT r.id revision_id,r.variant_id,r.shop_id,r.name,r.description,r.category,r.subcategory,
              (r.photo_data IS NOT NULL) has_photo,r.created_at,s.name shop_name,
              (p.variant_id IS NOT NULL) has_publication
       FROM product_publication_revisions r JOIN shops s ON s.id=r.shop_id
       LEFT JOIN product_publications p ON p.variant_id=r.variant_id
       WHERE r.status='pending' ORDER BY r.created_at,r.id LIMIT $1 OFFSET $2`,
      [pageSize, (page - 1) * pageSize],
    );
    return { items, total: count.total, page, pageSize };
  }

  async detail(id: string) {
    const [r] = await this.db.query(
      `SELECT r.id revision_id,r.variant_id,r.shop_id,r.name,r.description,r.category,r.subcategory,
         (r.photo_data IS NOT NULL) has_photo,r.status,r.reason,r.created_at,s.name shop_name,
         p.name approved_name,p.description approved_description,p.category approved_category,
         (p.photo_data IS NOT NULL) approved_has_photo
       FROM product_publication_revisions r JOIN shops s ON s.id=r.shop_id
       LEFT JOIN product_publications p ON p.variant_id=r.variant_id WHERE r.id=$1`,
      [id],
    );
    if (!r) throw new NotFoundException();
    return r;
  }

  async photo(id: string, approved: boolean) {
    const [r] = await this.db.query(
      approved
        ? 'SELECT p.photo_data FROM product_publication_revisions r JOIN product_publications p ON p.variant_id=r.variant_id WHERE r.id=$1'
        : 'SELECT photo_data FROM product_publication_revisions WHERE id=$1',
      [id],
    );
    if (!r?.photo_data) throw new NotFoundException();
    return r.photo_data as Buffer;
  }

  async decide(
    id: string,
    actor: string,
    decision: 'approved' | 'rejected',
    reason?: string,
  ) {
    const clean = (reason ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').trim();
    if (decision === 'rejected' && (!clean || clean.length > 500))
      throw new BadRequestException('Rejection reason required');
    return this.db.transaction(async (tx) => {
      // Lock the variant before the revision, matching the seller edit path.
      const [target] = await tx.query(
        'SELECT variant_id FROM product_publication_revisions WHERE id=$1',
        [id],
      );
      if (!target) throw new NotFoundException();
      const [variant] = await tx.query(
        'SELECT id FROM variants WHERE id=$1 FOR UPDATE',
        [target.variant_id],
      );
      if (!variant) throw new NotFoundException();
      const [r] = await tx.query(
        'SELECT * FROM product_publication_revisions WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (r.status !== 'pending')
        throw new ConflictException('Revision already decided');
      if (decision === 'approved')
        await tx.query(
          `INSERT INTO product_publications(variant_id,shop_id,name,description,category,subcategory,photo_data)
         VALUES($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT(variant_id) DO UPDATE SET name=excluded.name,description=excluded.description,
           category=excluded.category,subcategory=excluded.subcategory,photo_data=excluded.photo_data,approved_at=now()`,
          [
            r.variant_id,
            r.shop_id,
            r.name,
            r.description,
            r.category,
            r.subcategory,
            r.photo_data,
          ],
        );
      await tx.query(
        'UPDATE product_publication_revisions SET status=$2,decided_by=$3,reason=$4,decided_at=now() WHERE id=$1',
        [id, decision, actor, clean || null],
      );
      return { id, status: decision };
    });
  }

  async audit(page: number, pageSize: number) {
    const items = await this.db.query(
      `SELECT * FROM (
         SELECT 'partner' kind,application_id entity_id,status,actor_id,reason,created_at FROM partner_application_events WHERE actor_id IS NOT NULL
         UNION ALL
         SELECT 'product' kind,variant_id entity_id,status,decided_by actor_id,reason,decided_at created_at
         FROM product_publication_revisions WHERE decided_by IS NOT NULL
       ) audit ORDER BY created_at DESC,entity_id LIMIT $1 OFFSET $2`,
      [pageSize, (page - 1) * pageSize],
    );
    return { items, page, pageSize };
  }
}
