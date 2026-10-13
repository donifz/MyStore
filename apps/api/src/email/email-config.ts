import { isEmail } from 'class-validator';
export function encryptionKey() {
  const value = process.env.EMAIL_TOKEN_ENCRYPTION_KEY || '';
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value)
    throw new Error('EMAIL_TOKEN_ENCRYPTION_KEY must be 32 bytes in base64');
  return key;
}
export function publicBaseUrl() {
  const url = new URL(
    process.env.PUBLIC_BASE_URL ||
      (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:43104'),
  );
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
  )
    throw new Error('PUBLIC_BASE_URL must be an HTTPS origin in production');
  return url.origin;
}
export function readEmailConfig(env: NodeJS.ProcessEnv = process.env) {
  const enabled = env.EMAIL_ENABLED === 'true';
  if (!enabled) return { enabled: false as const };
  const url = new URL(env.PUBLIC_BASE_URL || '');
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !['http:', 'https:'].includes(url.protocol) ||
    (env.NODE_ENV === 'production' && url.protocol !== 'https:')
  )
    throw new Error('PUBLIC_BASE_URL invalid');
  const value = env.EMAIL_TOKEN_ENCRYPTION_KEY || '';
  if (
    Buffer.from(value, 'base64').length !== 32 ||
    Buffer.from(value, 'base64').toString('base64') !== value
  )
    throw new Error('EMAIL_TOKEN_ENCRYPTION_KEY invalid');
  if (
    env.EMAIL_WORKER_MODE &&
    !['inline', 'separate'].includes(env.EMAIL_WORKER_MODE)
  )
    throw new Error('Unknown email worker mode');
  const provider = env.EMAIL_PROVIDER || 'smtp';
  if (provider === 'gmail') {
    if (
      !env.GMAIL_FROM ||
      !isEmail(env.GMAIL_FROM) ||
      /[\r\n]/.test(env.GMAIL_FROM) ||
      !env.GMAIL_CLIENT_ID ||
      !env.GMAIL_CLIENT_SECRET ||
      !env.GMAIL_REFRESH_TOKEN
    )
      throw new Error('Gmail configuration incomplete');
    return {
      enabled: true as const,
      provider: 'gmail' as const,
      from: env.GMAIL_FROM,
      clientId: env.GMAIL_CLIENT_ID,
      clientSecret: env.GMAIL_CLIENT_SECRET,
      refreshToken: env.GMAIL_REFRESH_TOKEN,
    };
  }
  if (provider !== 'smtp') throw new Error('Unknown email provider');
  const port = Number(env.SMTP_PORT || 465);
  if (
    !env.SMTP_HOST ||
    !env.SMTP_FROM ||
    /[\r\n]/.test(env.SMTP_FROM) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw new Error('SMTP configuration incomplete');
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD))
    throw new Error('SMTP credentials incomplete');
  return {
    enabled: true as const,
    provider: 'smtp' as const,
    host: env.SMTP_HOST,
    port,
    secure: env.SMTP_SECURE !== 'false',
    from: env.SMTP_FROM,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD! }
      : undefined,
  };
}
