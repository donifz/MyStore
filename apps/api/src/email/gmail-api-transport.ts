import MailComposer from 'nodemailer/lib/mail-composer';
import { EmailMessage } from './email.types';
export type GmailConfig = {
  provider: 'gmail';
  from: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};
export class GmailApiTransport {
  private token: { value: string; until: number } | null = null;
  constructor(
    private readonly config: GmailConfig,
    private readonly http: typeof fetch = fetch,
  ) {}
  async send(message: EmailMessage, messageId: string) {
    const signal = AbortSignal.timeout(30000);
    try {
      if (!this.token || this.token.until <= Date.now()) {
        const response = await this.http(
          'https://oauth2.googleapis.com/token',
          {
            method: 'POST',
            signal,
            redirect: 'error',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: this.config.clientId,
              client_secret: this.config.clientSecret,
              refresh_token: this.config.refreshToken,
              grant_type: 'refresh_token',
            }).toString(),
          },
        );
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (
          typeof data.access_token !== 'string' ||
          !data.access_token ||
          !Number.isFinite(Number(data.expires_in)) ||
          Number(data.expires_in) <= 0
        )
          throw new Error();
        this.token = {
          value: data.access_token,
          until: Date.now() + Math.max(0, Number(data.expires_in) - 60) * 1000,
        };
      }
      const raw = await new MailComposer({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        messageId,
      })
        .compile()
        .build();
      if (signal.aborted) throw new Error();
      const response = await this.http(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          signal,
          redirect: 'error',
          headers: {
            authorization: 'Bearer ' + this.token.value,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ raw: raw.toString('base64url') }),
        },
      );
      if (response.status === 401) this.token = null;
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (typeof data.id !== 'string' || !data.id) throw new Error();
    } catch {
      throw new Error('Gmail delivery failed');
    }
  }
  close() {
    this.token = null;
  }
}
