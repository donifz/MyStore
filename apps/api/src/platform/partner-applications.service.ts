import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
import { EmailQueueService } from '../email/email-queue.service';
import { publicBaseUrl, encryptionKey } from '../email/email-config';
import { hashPassword } from '../auth/password';

export type ApplicationInput = {
  shopName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  category: string;
  shopType: string;
  agreed: boolean;
};
export type DecisionInput = {
  expectedStatus: 'new' | 'in_review' | 'rejected';
  decision: 'in_review' | 'approved' | 'rejected';
  reason?: string;
};

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class PartnerApplicationsService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly email: EmailQueueService,
  ) {}

  async create(input: ApplicationInput) {
    if (!input.agreed) throw new BadRequestException('Agreement required');
    const email = input.email.trim().toLowerCase();
    try {
      return await this.db.transaction(async (tx) => {
        const [existing] = await tx.query(
          'SELECT 1 FROM users WHERE email=$1',
          [email],
        );
        if (existing) throw new ConflictException('Application unavailable');
        const id = randomUUID();
        await tx.query(
          'INSERT INTO partner_applications(id,shop_name,email,phone,city,address,category,shop_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            id,
            input.shopName.trim(),
            email,
            input.phone.trim(),
            input.city.trim(),
            input.address.trim(),
            input.category.trim(),
            input.shopType,
          ],
        );
        await tx.query(
          "INSERT INTO partner_application_events(application_id,status) VALUES($1,'new')",
          [id],
        );
        return { id, status: 'new' };
      });
    } catch (error: any) {
      if (error.code === '23505')
        throw new ConflictException('Application unavailable');
      throw error;
    }
  }

  async list(page = 1, pageSize = 25, search = '', status = '', city = '') {
    const params = [
      '%' + search.replace(/[\\%_]/g, '\\$&') + '%',
      status,
      city,
    ];
    const where =
      "(shop_name ILIKE $1 OR email ILIKE $1) AND ($2='' OR status=$2) AND ($3='' OR city=$3)";
    const [count] = await this.db.query(
      'SELECT count(*)::int total FROM partner_applications WHERE ' + where,
      params,
    );
    const items = await this.db.query(
      'SELECT id,shop_name,email,phone,city,address,category,status,rejection_reason,shop_id,created_at,updated_at FROM partner_applications WHERE ' +
        where +
        ' ORDER BY created_at DESC,id LIMIT $4 OFFSET $5',
      [...params, pageSize, (page - 1) * pageSize],
    );
    return { items, total: count.total, page, pageSize };
  }

  async detail(id: string) {
    const [application] = await this.db.query(
      'SELECT id,shop_name,email,phone,city,address,category,status,rejection_reason,shop_id,created_at,updated_at FROM partner_applications WHERE id=$1',
      [id],
    );
    if (!application) throw new NotFoundException();
    const events = await this.db.query(
      'SELECT status,actor_id,reason,created_at FROM partner_application_events WHERE application_id=$1 ORDER BY created_at,id',
      [id],
    );
    return { ...application, events };
  }

  async decide(id: string, actor: string, input: DecisionInput) {
    const reason = (input.reason ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').trim();
    if (input.decision === 'rejected' && (!reason || reason.length > 500))
      throw new BadRequestException('Rejection reason required');
    if (
      (input.decision === 'in_review' &&
        !['new', 'rejected'].includes(input.expectedStatus)) ||
      (input.decision !== 'in_review' &&
        !['new', 'in_review'].includes(input.expectedStatus))
    )
      throw new BadRequestException('Invalid status transition');
    return this.db.transaction(async (tx) => {
      const [row] = await tx.query(
        'SELECT * FROM partner_applications WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!row) throw new NotFoundException();
      if (row.status !== input.expectedStatus)
        throw new ConflictException('Application status changed');
      let shopId: string | null = row.shop_id;
      let activationUrl: string | undefined;
      if (input.decision === 'approved') {
        const [existing] = await tx.query(
          'SELECT 1 FROM users WHERE email=$1',
          [row.email],
        );
        if (existing) throw new ConflictException('Application unavailable');
        shopId = randomUUID();
        await tx.query('INSERT INTO shops(id,name,shop_type) VALUES($1,$2,$3)', [
          shopId,
          row.shop_name,
          row.shop_type,
        ]);
        // Bootstrap category tree atomically with approved shop creation.
        await tx.query(
          `INSERT INTO shop_categories(shop_id,name,built_in,platform_category_code)
           SELECT $1,name,true,platform_category_code
           FROM shop_category_templates WHERE shop_type=$2 AND parent_name=''
           ON CONFLICT DO NOTHING`,
          [shopId, row.shop_type],
        );
        await tx.query(
          `INSERT INTO shop_categories(shop_id,parent_id,name,built_in,platform_category_code)
           SELECT $1,root.id,t.name,true,t.platform_category_code
           FROM shop_category_templates t
           JOIN shop_categories root ON root.shop_id=$1 AND root.parent_id IS NULL
             AND root.name=t.parent_name
           WHERE t.shop_type=$2 AND t.parent_name<>''
           ON CONFLICT DO NOTHING`,
          [shopId, row.shop_type],
        );
        const token = randomBytes(32).toString('hex');
        await tx.query(
          "INSERT INTO partner_invitations(application_id,token_hash,expires_at) VALUES($1,$2,now()+interval '7 days')",
          [id, hashToken(token)],
        );
        activationUrl = `/partner/activate?token=${token}`;
        let canEmail = false;
        try {
          encryptionKey();
          canEmail = true;
        } catch {}
        if (canEmail)
          await this.email.enqueue(
            tx,
            'partner:' + id,
            {
              to: row.email,
              subject: 'Ваш магазин одобрен в MyStore',
              text: `Установите пароль для кабинета магазина «${row.shop_name}». Ссылка действует 7 дней:\n${publicBaseUrl()}${activationUrl}`,
              secret: { kind: 'partner', referenceId: id },
            },
            shopId,
          );
      }
      await tx.query(
        'UPDATE partner_applications SET status=$2,rejection_reason=$3,shop_id=$4,updated_at=now() WHERE id=$1',
        [
          id,
          input.decision,
          input.decision === 'rejected' ? reason : null,
          shopId,
        ],
      );
      await tx.query(
        'INSERT INTO partner_application_events(application_id,status,actor_id,reason) VALUES($1,$2,$3,$4)',
        [id, input.decision, actor, reason || null],
      );
      return {
        id,
        status: input.decision,
        shopId,
        ...(activationUrl ? { activationUrl } : {}),
      };
    });
  }

  async activate(token: string, password: string) {
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new BadRequestException('Invalid invitation');
    const passwordHash = await hashPassword(password);
    try {
      return await this.db.transaction(async (tx) => {
        const [invite] = await tx.query(
          `SELECT i.application_id,a.email,a.shop_id
           FROM partner_invitations i
           JOIN partner_applications a ON a.id=i.application_id
           WHERE i.token_hash=$1 AND i.used_at IS NULL
             AND i.expires_at>now() AND a.status='approved'
           FOR UPDATE OF i,a`,
          [hashToken(token)],
        );
        if (!invite) throw new BadRequestException('Invalid invitation');
        const id = randomUUID();
        await tx.query(
          'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',
          [id, invite.email, passwordHash],
        );
        await tx.query(
          "INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,'owner')",
          [invite.shop_id, id],
        );
        await tx.query(
          'UPDATE partner_invitations SET used_at=now() WHERE application_id=$1',
          [invite.application_id],
        );
        return { activated: true };
      });
    } catch (error: any) {
      if (error.code === '23505')
        throw new BadRequestException('Invalid invitation');
      throw error;
    }
  }
}
