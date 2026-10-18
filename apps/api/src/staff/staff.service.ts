import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { DATABASE } from '../database';
import { EmailQueueService } from '../email/email-queue.service';
import { publicBaseUrl } from '../email/email-config';
import { StaffRole } from '../email/email.types';
import { accessOperation } from '../auth/access-operations';
import { hashPassword } from '../auth/password';
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
@Injectable()
export class StaffService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly email: EmailQueueService,
  ) {}
  async owner(tx: EntityManager, shop: string, actor: string) {
    await tx.query('SELECT id FROM shops WHERE id=$1 FOR UPDATE', [shop]);
    const [member] = await tx.query(
      'SELECT role FROM memberships WHERE shop_id=$1 AND user_id=$2',
      [shop, actor],
    );
    if (member?.role !== 'owner') throw new ForbiddenException();
  }
  async list(shop: string, actor: string) {
    return this.db.transaction(async (tx) => {
      await this.owner(tx, shop, actor);
      return {
        members: await tx.query(
          `SELECT u.id,u.email,m.role,(m.role='owner' OR m.can_return) AS "canReturn",(m.role='owner' OR m.can_view_reports) AS "canViewReports" FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.shop_id=$1 ORDER BY u.email`,
          [shop],
        ),
        invitations: await tx.query(
          'SELECT id,email,role,expires_at,created_at FROM staff_invitations WHERE shop_id=$1 AND used_at IS NULL AND cancelled_at IS NULL ORDER BY created_at DESC',
          [shop],
        ),
      };
    });
  }
  async createDirect(
    shop: string,
    actor: string,
    email: string,
    role: StaffRole,
    key: string,
  ) {
    email = email.trim().toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || email.length > 254)
      throw new BadRequestException('Invalid email');
    return this.db.transaction(async (tx) => {
      await this.owner(tx, shop, actor);
      return accessOperation(
        tx,
        'staff:' + shop.toLowerCase(),
        key,
        { actor, kind: 'direct-create', email, role },
        async () => {
          await tx.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
            ['email:' + email],
          );
          const [existing] = await tx.query(
            'SELECT id FROM users WHERE email=$1 FOR UPDATE',
            [email],
          );
          const password = existing ? null : randomBytes(24).toString('base64url');
          const userId = existing?.id ?? randomUUID();
          if (!existing)
            await tx.query(
              'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',
              [userId, email, await hashPassword(password!)],
            );
          const [member] = await tx.query(
            'SELECT 1 FROM memberships WHERE shop_id=$1 AND user_id=$2',
            [shop, userId],
          );
          if (member) throw new ConflictException('Already a member');
          await tx.query(
            'INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,$3)',
            [shop, userId, role],
          );
          await tx.query(
            'UPDATE staff_invitations SET cancelled_at=now() WHERE shop_id=$1 AND email=$2 AND used_at IS NULL AND cancelled_at IS NULL',
            [shop, email],
          );
          await this.audit(tx, shop, actor, 'staff:direct-create', userId, {
            email,
            role,
            existingAccount: !!existing,
          });
          return {
            id: userId,
            email,
            role,
            temporaryPassword: password,
            existingAccount: !!existing,
          };
        },
      );
    });
  }
  async invite(
    shop: string,
    actor: string,
    email: string,
    role: StaffRole,
    key: string,
  ) {
    email = email.trim().toLowerCase();
    return this.db.transaction(async (tx) => {
      await this.owner(tx, shop, actor);
      return accessOperation(
        tx,
        'staff:' + shop.toLowerCase(),
        key,
        { actor, kind: 'invite', email, role },
        async () => {
          const [exists] = await tx.query(
            'SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.shop_id=$1 AND u.email=$2',
            [shop, email],
          );
          if (exists) throw new ConflictException('Already a member');
          await tx.query(
            'UPDATE staff_invitations SET cancelled_at=now() WHERE shop_id=$1 AND email=$2 AND used_at IS NULL AND cancelled_at IS NULL',
            [shop, email],
          );
          const id = randomUUID(),
            token = randomBytes(32).toString('hex');
          await tx.query(
            "INSERT INTO staff_invitations(id,shop_id,email,role,token_hash,expires_at,created_by) VALUES($1,$2,$3,$4,$5,now()+interval '7 days',$6)",
            [id, shop, email, role, tokenHash(token), actor],
          );
          await this.email.enqueue(
            tx,
            'staff:' + id,
            {
              to: email,
              subject: 'Приглашение в MyStore',
              text: `Вас пригласили в магазин MyStore. Ссылка действует 7 дней:\n${publicBaseUrl()}/seller/staff/accept?token=${token}`,
              secret: { kind: 'staff', referenceId: id },
            },
            shop,
          );
          await this.audit(tx, shop, actor, 'staff:invite', id, {
            email,
            role,
          });
          return { id, email, role };
        },
      );
    });
  }
  async cancel(shop: string, actor: string, id: string, key: string) {
    return this.db.transaction(async (tx) => {
      await this.owner(tx, shop, actor);
      return accessOperation(
        tx,
        'staff:' + shop.toLowerCase(),
        key,
        { actor, kind: 'cancel', id },
        async () => {
          const [row] = await tx.query(
            'SELECT * FROM staff_invitations WHERE shop_id=$1 AND id=$2 FOR UPDATE',
            [shop, id],
          );
          if (!row) throw new NotFoundException();
          if (row.used_at) throw new ConflictException('Already accepted');
          await tx.query(
            'UPDATE staff_invitations SET cancelled_at=COALESCE(cancelled_at,now()) WHERE id=$1',
            [id],
          );
          await this.audit(tx, shop, actor, 'staff:cancel', id, {});
          return { cancelled: true };
        },
      );
    });
  }
  async change(
    shop: string,
    actor: string,
    user: string,
    role: StaffRole | null,
    key: string,
  ) {
    return this.db.transaction(async (tx) => {
      await this.owner(tx, shop, actor);
      return accessOperation(
        tx,
        'staff:' + shop.toLowerCase(),
        key,
        { actor, kind: 'change', user, role },
        async () => {
          const [row] = await tx.query(
            'SELECT role FROM memberships WHERE shop_id=$1 AND user_id=$2 FOR UPDATE',
            [shop, user],
          );
          if (!row) throw new NotFoundException();
          if (row.role === 'owner' || user === actor)
            throw new ForbiddenException();
          const [shift] = await tx.query(
            'SELECT id FROM cash_shifts WHERE shop_id=$1 AND actor_id=$2 AND closed_at IS NULL',
            [shop, user],
          );
          if (shift) throw new ConflictException('Close employee shift first');
          if (role)
            await tx.query(
              'UPDATE memberships SET role=$3,can_return=false,can_view_reports=false WHERE shop_id=$1 AND user_id=$2',
              [shop, user, role],
            );
          else
            await tx.query(
              'DELETE FROM memberships WHERE shop_id=$1 AND user_id=$2',
              [shop, user],
            );
          await this.audit(
            tx,
            shop,
            actor,
            role ? 'staff:role' : 'staff:disable',
            user,
            { role },
          );
          return { updated: true };
        },
      );
    });
  }
  async permissions(
    shop: string,
    actor: string,
    user: string,
    permissions: { canReturn: boolean; canViewReports: boolean },
    key: string,
  ) {
    user = user.toLowerCase();
    return this.db.transaction(async (tx) => {
      await this.owner(tx, shop, actor);
      return accessOperation(
        tx,
        'staff:' + shop.toLowerCase(),
        key,
        { actor, kind: 'permissions', user, ...permissions },
        async () => {
          const [row] = await tx.query(
            'SELECT role,can_return,can_view_reports FROM memberships WHERE shop_id=$1 AND user_id=$2 FOR UPDATE',
            [shop, user],
          );
          if (!row) throw new NotFoundException();
          if (row.role === 'owner' || user === actor)
            throw new ForbiddenException();
          const before = {
            canReturn: row.can_return,
            canViewReports: row.can_view_reports,
          };
          if (
            before.canReturn !== permissions.canReturn ||
            before.canViewReports !== permissions.canViewReports
          ) {
            await tx.query(
              'UPDATE memberships SET can_return=$3,can_view_reports=$4 WHERE shop_id=$1 AND user_id=$2',
              [shop, user, permissions.canReturn, permissions.canViewReports],
            );
            await this.audit(tx, shop, actor, 'staff:permissions', user, {
              before,
              after: permissions,
            });
          }
          return { updated: true };
        },
      );
    });
  }
  async accept(
    token: string,
    password: string | undefined,
    actor?: string,
    key?: string,
  ) {
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new BadRequestException('Invalid invitation');
    return this.db.transaction(async (tx) => {
      const [lookup] = await tx.query(
        'SELECT shop_id FROM staff_invitations WHERE token_hash=$1',
        [tokenHash(token)],
      );
      if (!lookup) throw new BadRequestException('Invalid invitation');
      await tx.query('SELECT id FROM shops WHERE id=$1 FOR UPDATE', [
        lookup.shop_id,
      ]);
      return accessOperation(
        tx,
        'staff-accept:' + tokenHash(token),
        key!,
        { actor: actor || null, password: password || null },
        async () => {
          const [i] = await tx.query(
            'SELECT * FROM staff_invitations WHERE token_hash=$1 AND used_at IS NULL AND cancelled_at IS NULL AND expires_at>now() FOR UPDATE',
            [tokenHash(token)],
          );
          if (!i) throw new BadRequestException('Invalid invitation');
          // Serialize account creation/acceptance across different shop invitations.
          await tx.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
            ['email:' + i.email],
          );
          const [existing] = await tx.query(
            'SELECT id FROM users WHERE email=$1 FOR UPDATE',
            [i.email],
          );
          let user = existing?.id;
          if (user) {
            if (actor !== user)
              throw new ForbiddenException('Sign in as invited email');
          } else {
            if (!password || password.length < 12 || password.length > 256)
              throw new BadRequestException(
                'Password requires 12–256 characters',
              );
            user = randomUUID();
            await tx.query(
              'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',
              [user, i.email, await hashPassword(password)],
            );
          }
          const [member] = await tx.query(
            'SELECT role FROM memberships WHERE shop_id=$1 AND user_id=$2',
            [i.shop_id, user],
          );
          if (member) throw new ConflictException('Already a member');
          await tx.query(
            'INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,$3)',
            [i.shop_id, user, i.role],
          );
          await tx.query(
            'UPDATE staff_invitations SET used_at=now() WHERE id=$1',
            [i.id],
          );
          await this.audit(tx, i.shop_id, user, 'staff:accept', i.id, {});
          return { accepted: true };
        },
      );
    });
  }
  async audit(
    tx: EntityManager,
    shop: string,
    actor: string,
    action: string,
    id: string,
    details: unknown,
  ) {
    await tx.query(
      "INSERT INTO audit_log(shop_id,actor_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,'staff',$4,$5)",
      [shop, actor, action, id, JSON.stringify(details)],
    );
  }
}
