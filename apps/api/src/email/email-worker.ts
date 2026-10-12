import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { EmailQueueService } from './email-queue.service';
import { EmailMessage } from './email.types';
export type EmailTransport = {
  send(message: EmailMessage, messageId: string): Promise<void>;
};
export class EmailWorker {
  private stopped = false;
  private running: Promise<number> | null = null;
  constructor(
    private readonly db: DataSource,
    private readonly transport: EmailTransport,
  ) {}
  tick(): Promise<number> {
    if (this.running) return this.running;
    if (this.stopped) return Promise.resolve(0);
    this.running = this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  async stop() {
    this.stopped = true;
    await this.running;
  }
  private async run() {
    await this.db
      .query(`UPDATE email_deliveries d SET status='cancelled',encrypted_payload=NULL,last_error=NULL WHERE d.status='pending' AND d.secret_kind IS NOT NULL AND (
      (d.secret_kind='staff' AND NOT EXISTS(SELECT 1 FROM staff_invitations i WHERE i.id=d.secret_id AND i.used_at IS NULL AND i.cancelled_at IS NULL AND i.expires_at>now())) OR
      (d.secret_kind='reset' AND NOT EXISTS(SELECT 1 FROM password_resets r WHERE r.id=d.secret_id AND r.used_at IS NULL AND r.expires_at>now())) OR
      (d.secret_kind='partner' AND NOT EXISTS(SELECT 1 FROM partner_invitations p WHERE p.application_id=d.secret_id AND p.used_at IS NULL AND p.expires_at>now()))
    )`);
    const q = new EmailQueueService(this.db);
    let processed = 0;
    for (let n = 0; n < 20 && !this.stopped; n++) {
      const lease = randomUUID();
      const row = await this.db.transaction(async (tx) => {
        const [r] = await tx.query(
          "SELECT * FROM email_deliveries WHERE (status='pending' AND available_at<=now()) OR (status='sending' AND lease_until<now()) ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",
        );
        if (!r) return null;
        await tx.query(
          "UPDATE email_deliveries SET status='sending',lease_token=$2,lease_until=now()+interval '120 seconds' WHERE id=$1",
          [r.id, lease],
        );
        return r;
      });
      if (!row) break;
      const heartbeat = setInterval(() => {
        void this.db
          .query(
            "UPDATE email_deliveries SET lease_until=now()+interval '120 seconds' WHERE id=$1 AND lease_token=$2 AND status='sending'",
            [row.id, lease],
          )
          .catch(() => {});
      }, 30000);
      try {
        if (!(await q.validSecret(row))) {
          await this.db.query(
            "UPDATE email_deliveries SET status='cancelled',encrypted_payload=NULL,lease_until=NULL,lease_token=NULL WHERE id=$1 AND lease_token=$2",
            [row.id, lease],
          );
          continue;
        }
        await this.transport.send(q.decode(row), row.message_id);
        await this.db.query(
          "UPDATE email_deliveries SET status='sent',sent_at=now(),encrypted_payload=NULL,lease_until=NULL,lease_token=NULL,last_error=NULL WHERE id=$1 AND lease_token=$2",
          [row.id, lease],
        );
      } catch {
        const attempts = Number(row.attempts) + 1;
        const minutes = [1, 5, 15, 60, 240][attempts - 1] || 240;
        await this.db.query(
          "UPDATE email_deliveries SET status=$3,attempts=$4,available_at=now()+$5*interval '1 minute',last_error='SMTP delivery failed',lease_until=NULL,lease_token=NULL,encrypted_payload=CASE WHEN $3='failed' THEN NULL ELSE encrypted_payload END WHERE id=$1 AND lease_token=$2",
          [
            row.id,
            lease,
            attempts >= 6 ? 'failed' : 'pending',
            attempts,
            minutes,
          ],
        );
      } finally {
        clearInterval(heartbeat);
        processed++;
      }
    }
    return processed;
  }
}

export async function stopEmailWorker(
  worker: EmailWorker,
  running: Promise<unknown> | null,
) {
  const stopped = worker.stop();
  await running?.catch(() => {});
  await stopped;
}
