import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
import { EmailQueueService } from '../email/email-queue.service';
import { publicBaseUrl, encryptionKey } from '../email/email-config';
import { accessOperation } from './access-operations';
import { tokenHash } from '../staff/staff.service';
import { hashPassword } from './password';
@Injectable()
export class PasswordRecoveryService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly email: EmailQueueService,
  ) {}
  async request(email: string, key: string) {
    email = email.trim().toLowerCase();
    return this.db.transaction(async (tx) =>
      accessOperation(
        tx,
        'reset-request:' + tokenHash(email),
        key,
        { email },
        async () => {
          await tx.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
            ['email:' + email],
          );
          let canEmail = false;
          try {
            encryptionKey();
            publicBaseUrl();
            canEmail = true;
          } catch {}
          if (!canEmail) return { accepted: true };
          const [user] = await tx.query(
            'SELECT id FROM users WHERE email=$1 FOR UPDATE',
            [email],
          );
          if (user) {
            await tx.query(
              'UPDATE password_resets SET used_at=COALESCE(used_at,now()) WHERE user_id=$1',
              [user.id],
            );
            const id = randomUUID(),
              token = randomBytes(32).toString('hex');
            await tx.query(
              "INSERT INTO password_resets(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",
              [id, user.id, tokenHash(token)],
            );
            await this.email.enqueue(
              tx,
              'reset:' + id,
              {
                to: email,
                subject: 'Восстановление доступа MyStore',
                text: `Чтобы установить новый пароль, откройте ссылку в течение 30 минут:\n${publicBaseUrl()}/seller/reset-password?token=${token}\nЕсли вы не запрашивали восстановление, просто проигнорируйте письмо.`,
                secret: { kind: 'reset', referenceId: id },
              },
              null,
            );
          }
          return { accepted: true };
        },
      ),
    );
  }
  async reset(token: string, password: string, key: string) {
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new BadRequestException('Invalid reset link');
    return this.db.transaction(async (tx) =>
      accessOperation(
        tx,
        'reset:' + tokenHash(token),
        key,
        { password },
        async () => {
          const [lookup] = await tx.query(
            'SELECT user_id FROM password_resets WHERE token_hash=$1',
            [tokenHash(token)],
          );
          if (!lookup) throw new BadRequestException('Invalid reset link');
          await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [
            lookup.user_id,
          ]);
          const [reset] = await tx.query(
            'SELECT * FROM password_resets WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',
            [tokenHash(token)],
          );
          if (!reset) throw new BadRequestException('Invalid reset link');
          await tx.query('UPDATE users SET password_hash=$2 WHERE id=$1', [
            reset.user_id,
            await hashPassword(password),
          ]);
          await tx.query(
            'UPDATE password_resets SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',
            [reset.user_id],
          );
          await tx.query('DELETE FROM sessions WHERE user_id=$1', [
            reset.user_id,
          ]);
          return { reset: true };
        },
      ),
    );
  }
}
