import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { DATABASE } from '../database';
import { checkPassword, hashPassword } from '../auth/password';
import { normalizeKyrgyzPhone } from './kyrgyz-phone';

const PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generateBuyerPassword(length = 12): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return out;
}

@Injectable()
export class BuyerAuthService {
  private readonly secret: string;
  private readonly dummyHash = hashPassword('invalid-buyer-account');
  private readonly attempts = new Map<
    string,
    { count: number; expires: number }
  >();

  constructor(@Inject(DATABASE) private readonly db: DataSource) {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('SESSION_SECRET must contain at least 32 characters');
    }
    this.secret = secret;
  }

  private digest(token: string) {
    return createHmac('sha256', this.secret)
      .update('buyer:' + token)
      .digest('hex');
  }

  private initialPasswordKey() {
    return createHash('sha256')
      .update('buyer-initial-pw:' + this.secret)
      .digest();
  }

  encryptInitialPassword(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.initialPasswordKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  decryptInitialPassword(encoded: string): string {
    const [ivStr, tagStr, dataStr] = encoded.split('.');
    if (!ivStr || !tagStr || !dataStr) {
      throw new Error('Invalid encrypted initial password');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.initialPasswordKey(),
      Buffer.from(ivStr, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagStr, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataStr, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  async createSession(buyerId: string, tx?: EntityManager) {
    const token = randomBytes(32).toString('hex');
    const runner = tx ?? this.db;
    await runner.query(
      "INSERT INTO buyer_sessions(token_hash,buyer_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
      [this.digest(token), buyerId],
    );
    return { token, expiresIn: 43200 };
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
      'SELECT id,password_hash,phone_verified_at FROM buyer_accounts WHERE phone_e164=$1',
      [phone],
    );
    const valid = await checkPassword(
      password,
      row?.password_hash ?? (await this.dummyHash),
    );
    if (!row || !valid)
      throw new UnauthorizedException('Неверный номер или пароль');
    // Reconcile cards created after the buyer verified the phone.
    // An unverified account must NEVER claim a shop record by number alone.
    if (row.phone_verified_at) {
      await this.db.query(
        `UPDATE shop_customers
         SET buyer_account_id=$1,updated_at=now()
         WHERE phone_e164=$2 AND buyer_account_id IS NULL`,
        [row.id, phone],
      );
    }
    return this.createSession(row.id);
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
      `SELECT id,phone_e164,display_name,phone_verified_at,created_at,
       initial_password_enc IS NOT NULL AS "hasInitialPassword"
       FROM buyer_accounts WHERE id=$1`,
      [buyerId],
    );
    if (!row) throw new UnauthorizedException();
    // A verified Telegram-own-contact phone or accepted one-time invitation
    // may link customer cards. Unverified phone matches cannot grant access.
    const shops = await this.db.query(
      `SELECT s.id AS "shopId",s.name AS "shopName"
       FROM shop_customers sc JOIN shops s ON s.id=sc.shop_id
       WHERE sc.buyer_account_id=$1 ORDER BY s.name`,
      [buyerId],
    );
    return {
      id: row.id,
      phone: row.phone_e164,
      name: row.display_name,
      phoneVerified: !!row.phone_verified_at,
      hasInitialPassword: !!row.hasInitialPassword,
      shops,
      createdAt: row.created_at.toISOString(),
    };
  }

  async revealInitialPassword(buyerId: string) {
    const [row] = await this.db.query(
      'SELECT initial_password_enc FROM buyer_accounts WHERE id=$1',
      [buyerId],
    );
    if (!row) throw new UnauthorizedException();
    if (!row.initial_password_enc) {
      return { password: null as string | null };
    }
    return {
      password: this.decryptInitialPassword(row.initial_password_enc),
    };
  }

  async logout(token: string) {
    await this.db.query('DELETE FROM buyer_sessions WHERE token_hash=$1', [
      this.digest(token),
    ]);
    return { revoked: true };
  }
}
