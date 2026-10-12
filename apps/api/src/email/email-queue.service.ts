import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { DATABASE } from '../database';
import { encryptionKey } from './email-config';
import { isEmail } from 'class-validator';
import { EmailMessage } from './email.types';
export function validRecipient(to: string) {
  return (
    typeof to === 'string' &&
    to.length <= 254 &&
    !/[\r\n]/.test(to) &&
    isEmail(to)
  );
}
@Injectable()
export class EmailQueueService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}
  async enqueue(
    tx: EntityManager,
    dedupeKey: string,
    message: EmailMessage,
    shopId: string | null,
  ): Promise<string> {
    if (
      !validRecipient(message.to) ||
      /[\r\n]/.test(message.subject) ||
      message.to.length > 254 ||
      message.subject.length > 200 ||
      message.text.length > 10000
    )
      throw new BadRequestException('Invalid email');
    let encrypted: string | null = null;
    if (message.secret) {
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', encryptionKey(), iv);
      const data = Buffer.concat([
        c.update(JSON.stringify(message), 'utf8'),
        c.final(),
      ]);
      encrypted = Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
    }
    const id = randomUUID();
    const [row] = await tx.query(
      'INSERT INTO email_deliveries(id,dedupe_key,shop_id,recipient,payload,encrypted_payload,secret_kind,secret_id,message_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(dedupe_key) DO UPDATE SET dedupe_key=excluded.dedupe_key RETURNING id',
      [
        id,
        dedupeKey,
        shopId,
        message.to,
        message.secret ? null : JSON.stringify(message),
        encrypted,
        message.secret?.kind || null,
        message.secret?.referenceId || null,
        `<${id}@mystore.invalid>`,
      ],
    );
    return row.id;
  }
  decode(row: any): EmailMessage {
    if (!row.encrypted_payload) return row.payload;
    const b = Buffer.from(row.encrypted_payload, 'base64');
    const c = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      b.subarray(0, 12),
    );
    c.setAuthTag(b.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([c.update(b.subarray(28)), c.final()]).toString('utf8'),
    );
  }
  async validSecret(row: any) {
    if (!row.secret_kind) return true;
    const tables: Record<string, string> = {
      staff: 'staff_invitations',
      reset: 'password_resets',
      partner: 'partner_invitations',
    };
    const table = tables[row.secret_kind];
    if (!table) return false;
    const idColumn = row.secret_kind === 'partner' ? 'application_id' : 'id';
    const [r] = await this.db.query(
      `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${idColumn}=$1 AND used_at IS NULL AND expires_at>now() ${row.secret_kind === 'staff' ? 'AND cancelled_at IS NULL' : ''}) AS valid`,
      [row.secret_id],
    );
    return r.valid === true;
  }
}
