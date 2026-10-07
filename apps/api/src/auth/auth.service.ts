import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
import { checkPassword, hashPassword } from './password';
@Injectable()
export class AuthService {
  private secret: string;
  private dummy: Promise<string>;
  constructor(@Inject(DATABASE) private readonly db: DataSource) {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32)
      throw new Error('SESSION_SECRET must contain at least 32 characters');
    this.secret = secret;
    this.dummy = hashPassword('dummy-nonexistent-user');
  }
  private digest(token: string) {
    return createHmac('sha256', this.secret).update(token).digest('hex');
  }
  async login(email: string, password: string) {
    const [user] = await this.db.query(
      'SELECT id,password_hash FROM users WHERE email=$1',
      [email.toLowerCase()],
    );
    const ok = await checkPassword(
      password,
      user?.password_hash ?? (await this.dummy),
    );
    if (!user || !ok) throw new UnauthorizedException('Invalid credentials');
    const token = randomBytes(32).toString('hex');
    await this.db.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
      [this.digest(token), user.id],
    );
    return { token, expiresIn: 43200 };
  }
  async authenticate(token: string): Promise<string> {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new UnauthorizedException();
    const [session] = await this.db.query(
      'SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()',
      [this.digest(token)],
    );
    if (!session) throw new UnauthorizedException();
    return session.user_id;
  }
  async logout(token: string) {
    await this.db.query('DELETE FROM sessions WHERE token_hash=$1', [
      this.digest(token),
    ]);
    return { revoked: true };
  }
}
