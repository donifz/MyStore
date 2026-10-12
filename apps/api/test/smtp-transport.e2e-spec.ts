import { startSmtpServer } from './fixtures/smtp-server';
import { SmtpTransport } from '../src/email/smtp-transport';
import { createApp } from '../src/app';
import { setup, teardown } from './helpers';
import { EmailQueueService } from '../src/email/email-queue.service';
import { EmailWorker } from '../src/email/email-worker';
describe('real SMTP acceptance', () => {
  it('sends queued UTF-8 email through SMTP with stable Message-ID', async () => {
    const env = { ...process.env };
    const smtp = await startSmtpServer();
    let c: Awaited<ReturnType<typeof setup>> | undefined;
    let transport: SmtpTransport | undefined;
    try {
      Object.assign(process.env, {
        EMAIL_ENABLED: 'true',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: String(smtp.port),
        SMTP_SECURE: 'false',
        SMTP_FROM: 'mystore@example.test',
        PUBLIC_BASE_URL: 'http://localhost:43104',
        EMAIL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      });
      c = await setup(createApp);
      await c.db.query('TRUNCATE email_deliveries');
      const id = await c.db.transaction((tx) =>
        new EmailQueueService(c!.db).enqueue(
          tx,
          'smtp-real',
          {
            to: 'buyer@example.test',
            subject: 'Заказ готов',
            text: 'Ваш заказ готов к выдаче.',
          },
          null,
        ),
      );
      transport = new SmtpTransport();
      await new EmailWorker(c.db, transport).tick();
      expect(smtp.messages).toHaveLength(1);
      expect(smtp.messages[0].text).toBe('Ваш заказ готов к выдаче.');
      expect(smtp.messages[0].to).toBe('buyer@example.test');
      expect(smtp.messages[0].raw).toContain(`<${id}@mystore.invalid>`);
      expect(
        (
          await c.db.query('SELECT status FROM email_deliveries WHERE id=$1', [
            id,
          ])
        )[0].status,
      ).toBe('sent');
    } finally {
      transport?.close();
      await teardown(c);
      await smtp.close();
      for (const key of Object.keys(process.env))
        if (!(key in env)) delete process.env[key];
      Object.assign(process.env, env);
    }
  });
  it('closes a slow SMTP connection within the total 30 second deadline', async () => {
    const env = { ...process.env };
    const smtp = await startSmtpServer(0, true);
    let transport: SmtpTransport | undefined;
    try {
      Object.assign(process.env, {
        EMAIL_ENABLED: 'true',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: String(smtp.port),
        SMTP_SECURE: 'false',
        SMTP_FROM: 'mystore@example.test',
        PUBLIC_BASE_URL: 'http://localhost:43104',
        EMAIL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      });
      transport = new SmtpTransport();
      const attempt = transport
        .send(
          { to: 'buyer@example.test', subject: 'Deadline', text: 'body' },
          '<deadline@example.test>',
        )
        .then(
          () => false,
          () => true,
        );
      const completed = await Promise.race([
        attempt,
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), 31500),
        ),
      ]);
      expect(completed).toBe(true);
    } finally {
      transport?.close();
      await smtp.close();
      for (const k of Object.keys(process.env))
        if (!(k in env)) delete process.env[k];
      Object.assign(process.env, env);
    }
  }, 37000);
});
