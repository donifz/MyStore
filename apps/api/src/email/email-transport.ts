import { readEmailConfig } from './email-config';
import { GmailApiTransport } from './gmail-api-transport';
import { SmtpTransport } from './smtp-transport';
export function createEmailTransport() {
  const config = readEmailConfig();
  if (!config.enabled) throw new Error('Email disabled');
  return config.provider === 'gmail'
    ? new GmailApiTransport(config)
    : new SmtpTransport();
}
