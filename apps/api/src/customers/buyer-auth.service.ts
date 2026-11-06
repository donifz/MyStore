import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
import { checkPassword, hashPassword } from '../auth/password';
import { normalizeKyrgyzPhone } from './kyrgyz-phone';

@Injectable()
export class BuyerAuthService {
  private readonly secret: string;
  private readonly dummyHash = hashPassword('invalid-buyer-account');
  private readonly attempts = new Map<string, { count: number; expires: number }>();

  constructor(@Inject(DATABASE) private readonly db: DataSource) {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('SESSION_SECRET must contain at least 32 characters');
    }
    this.secret = secret;
  }

  private digest(token: string) {
    return createHmac('sha256', this.secret).update('buyer:' + token).digest('hex');
  }

  limit(key: string) {
    const now = Date.now();
    if (this.attempts.size > 10000) {
      for (const [id, state] of this.attempts) {
        if (state.expires <= now) this.attempts.delete(id);
      }
      if (this.attempts.size > 10000) this.attempts.clear();
    }
    const row = this.attempts.get(key);
    if (row && row.expires > now && row.count >= 8) {
      throw new HttpException('Слишком много попыток. Повторите позже.', 429);
    }
    this.attempts.set(key, {
      count: row && row.expires > now ? row.count + 1 : 1,
      expires: row && row.expires > now ? row.expires : now + 15 * 60_000,
    });
  }

  async register(phoneInput: string, nameInput: string, password: string) {
    const phone = normalizeKyrgyzPhone(phoneInput);
    const name = nameInput.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 120) {
      throw new BadRequestException('Укажите имя (2–120 символов)');
    }
    if (password.length < 12 || password.length > 256) {
      throw new BadRequestException('Пароль должен содержать 12–256 символов');
    }
    const hash = await hashPassword(password);
    try {
      const [row] = await this.db.query(
        'INSERT INTO buyer_accounts(phone_e164,display_name,password_hash) VALUES($1,$2,$3) RETURNING id',
        [phone, name, hash],
      );
      return { id: row.id, phone, phoneVerified: false };
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Аккаунт с этим номером уже существует');
      }
      throw error;
    }
  }

  async login(phoneInput: string, password: string) {
    const phone = normalizeKyrgyzPhone(phoneInput);
    const [row] = await this.db.query(
      'SELECT id,password_hash FROM buyer_accounts WHERE phone_e164=$1',
      [phone],
    );
    const valid = await checkPassword(
      password,
      row?.password_hash ?? (await this.dummyHash),
    );
    if (!row || !valid) throw new UnauthorizedException('Неверный номер или пароль');
    const token = randomBytes(32).toString('hex');
    await this.db.query(
      "INSERT INTO buyer_sessions(token_hash,buyer_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
      [this.digest(token), row.id],
    );
    return { token, expiresIn: 43200 };
  }

  async authenticate(token: string): Promise<string> {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new UnauthorizedException();
    const [row] = await this.db.query(
      'SELECT buyer_id FROM buyer_sessions WHERE token_hash=$1 AND expires_at>now()',
      [this.digest(token)],
    );
    if (!row) throw new UnauthorizedException();
    return row.buyer_id;
  }

  async me(buyerId: string) {
    const [row] = await this.db.query(
      'SELECT id,phone_e164,display_name,phone_verified_at,created_at FROM buyer_accounts WHERE id=$1',
      [buyerId],
    );
    if (!row) throw new UnauthorizedException();
    // Never expose an unverified phone's matching shop records.
    const shops = row.phone_verified_at
      ? await this.db.query(
          `SELECT s.id AS "shopId",s.name AS "shopName"
           FROM shop_customers sc JOIN shops s ON s.id=sc.shop_id
           WHERE sc.buyer_account_id=$1 ORDER BY s.name`,
          [buyerId],
        )
      : [];
    return {
      id: row.id,
      phone: row.phone_e164,
      name: row.display_name,
      phoneVerified: !!row.phone_verified_at,
      shops,
      createdAt: row.created_at.toISOString(),
    };
  }

  async logout(token: string) {
    await this.db.query('DELETE FROM buyer_sessions WHERE token_hash=$1', [
      this.digest(token),
    ]);
    return { revoked: true };
  }
}
