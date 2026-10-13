import SMTPConnection from 'nodemailer/lib/smtp-connection';
import MailComposer from 'nodemailer/lib/mail-composer';
import { readEmailConfig } from './email-config';
import { EmailMessage } from './email.types';
export class SmtpTransport {
  private readonly config = readEmailConfig();
  private readonly connections = new Set<SMTPConnection>();
  constructor() {
    if (!this.config.enabled) throw new Error('Email disabled');
  }
  async send(message: EmailMessage, messageId: string) {
    const c = this.config;
    if (!c.enabled) throw new Error('Email disabled');
    const mail = new MailComposer({
      from: c.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      messageId,
    }).compile();
    const raw = await mail.build();
    const connection = new SMTPConnection({
      host: c.host,
      port: c.port,
      secure: c.secure,
      requireTLS: process.env.NODE_ENV === 'production' && !c.secure,
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      dnsTimeout: 30000,
    });
    this.connections.add(connection);
    await new Promise<void>((resolve, reject) => {
      let finished = false;
      const finish = (error?: Error | null) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        this.connections.delete(connection);
        connection.close();
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(
        () => finish(new Error('SMTP total delivery deadline exceeded')),
        30000,
      );
      connection.once('error', finish);
      connection.once('end', () =>
        finish(new Error('SMTP connection closed before acceptance')),
      );
      const send = () =>
        connection.send(mail.getEnvelope(), raw, (error, info) => {
          if (error) return finish(error);
          if (!info?.accepted.length || info.rejected.length)
            return finish(new Error('SMTP recipient rejected'));
          finish();
        });
      connection.connect((error) => {
        if (error) return finish(error);
        if (finished) return;
        if (c.auth)
          connection.login(c.auth, (error, success) => {
            if (finished) return;
            if (error || !success)
              return finish(error || new Error('SMTP authentication failed'));
            send();
          });
        else send();
      });
    });
  }
  close() {
    for (const c of this.connections) c.close();
  }
}
