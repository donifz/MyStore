import {
  BadRequestException,
  HttpException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DataSource } from 'typeorm';
import { hashPassword } from '../auth/password';
import { DATABASE } from '../database';
import { BuyerAuthService, generateBuyerPassword } from './buyer-auth.service';
import { normalizeKyrgyzPhone } from './kyrgyz-phone';

type TelegramMessage = {
  chat?: { id?: number; type?: string };
  from?: { id?: number; is_bot?: boolean };
  text?: string;
  contact?: { phone_number?: string; user_id?: number };
};
type TelegramUpdate = { message?: TelegramMessage };

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
  const username = process.env.TELEGRAM_BOT_USERNAME ?? '';
  if (
    (process.env.NODE_ENV === 'production' &&
      process.env.TELEGRAM_VERIFY_ENABLED !== 'true') ||
    !/^\d+:[A-Za-z0-9_-]{30,}$/.test(token) ||
    !/^[A-Za-z0-9_-]{16,256}$/.test(secret) ||
    !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)
  ) {
    return null;
  }
  return { token, secret, username };
}

@Injectable()
export class BuyerTelegramService {
  private webhookReady = false;

  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly buyerAuth: BuyerAuthService,
  ) {}

  async registerWebhook(): Promise<void> {
    if (
      process.env.NODE_ENV !== 'production' ||
      process.env.TELEGRAM_AUTO_WEBHOOK !== 'true'
    )
      return;
    const config = telegramConfig();
    const publicBase = process.env.PUBLIC_BASE_URL;
    if (!config || !publicBase) {
      console.warn(
        '[buyer-telegram] webhook setup skipped: disabled or incomplete',
      );
      return;
    }
    let webhookUrl: string;
    try {
      const parsed = new URL(publicBase);
      if (
        parsed.protocol !== 'https:' ||
        parsed.username ||
        parsed.password ||
        parsed.port ||
        parsed.search ||
        parsed.hash ||
        parsed.pathname !== '/'
      )
        throw new Error('Invalid origin');
      webhookUrl = new URL(
        '/api/integrations/telegram/buyer-webhook',
        parsed.origin,
      ).toString();
    } catch {
      console.warn(
        '[buyer-telegram] webhook setup skipped: invalid public URL',
      );
      return;
    }
    // Errors and response payloads must not be logged: Telegram API URLs
    // contain a bot token, even when an HTTP error is returned.
    try {
      const base = `https://api.telegram.org/bot${config.token}/`;
      const me = await fetch(base + 'getMe', {
        signal: AbortSignal.timeout(8000),
      });
      const identity = (await me.json()) as {
        ok?: boolean;
        result?: { username?: string; is_bot?: boolean };
      };
      if (
        !me.ok ||
        identity.ok !== true ||
        identity.result?.is_bot !== true ||
        identity.result.username?.toLowerCase() !==
          config.username.toLowerCase()
      ) {
        console.warn('[buyer-telegram] username mismatch or invalid token');
        return;
      }
      const response = await fetch(base + 'setWebhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: config.secret,
          allowed_updates: ['message'],
          drop_pending_updates: false,
          max_connections: 4,
        }),
        signal: AbortSignal.timeout(8000),
      });
      const result = (await response.json()) as { ok?: boolean };
      if (response.ok && result.ok) {
        this.webhookReady = true;
        console.info('[buyer-telegram] webhook registered');
      } else {
        console.warn('[buyer-telegram] webhook registration failed');
      }
    } catch {
      console.warn('[buyer-telegram] Telegram API unreachable');
    }
  }

  config() {
    const config = telegramConfig();
    return {
      enabled:
        !!config &&
        (process.env.NODE_ENV !== 'production' || this.webhookReady),
      botUsername: config?.username ?? null,
    };
  }

  async issue(buyerId: string) {
    const config = telegramConfig();
    if (!this.config().enabled || !config) {
      throw new ServiceUnavailableException(
        'Подтверждение через Telegram пока не подключено',
      );
    }
    const token = randomBytes(24).toString('base64url');
    await this.db.transaction(async (tx) => {
      const [buyer] = await tx.query(
        'SELECT phone_verified_at FROM buyer_accounts WHERE id=$1 FOR UPDATE',
        [buyerId],
      );
      if (!buyer) throw new ForbiddenException();
      if (buyer.phone_verified_at) {
        throw new ConflictException('Номер уже подтверждён');
      }
      const [recent] = await tx.query(
        `SELECT id FROM buyer_telegram_verifications
         WHERE buyer_id=$1 AND created_at>now()-interval '30 seconds'
         LIMIT 1`,
        [buyerId],
      );
      if (recent)
        throw new HttpException('Повторите попытку через 30 секунд', 429);
      await tx.query(
        `UPDATE buyer_telegram_verifications
         SET revoked_at=now()
         WHERE buyer_id=$1 AND used_at IS NULL AND revoked_at IS NULL`,
        [buyerId],
      );
      await tx.query(
        `INSERT INTO buyer_telegram_verifications
         (buyer_id,token_hash,expires_at)
         VALUES ($1,$2,now()+interval '10 minutes')`,
        [buyerId, digest(token)],
      );
    });
    return {
      url: `https://t.me/${config.username}?start=${token}`,
      expiresIn: 600,
    };
  }

  async requestAuth() {
    const config = telegramConfig();
    if (!this.config().enabled || !config) {
      throw new ServiceUnavailableException(
        'Вход через Telegram пока не подключён',
      );
    }
    const token = randomBytes(24).toString('base64url');
    await this.db.query(
      `INSERT INTO buyer_telegram_auth_requests
       (token_hash, expires_at)
       VALUES ($1, now() + interval '10 minutes')`,
      [digest(token)],
    );
    return {
      url: `https://t.me/${config.username}?start=auth_${token}`,
      token,
      expiresIn: 600,
    };
  }

  async pollAuth(token: string) {
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) {
      throw new BadRequestException('Недействительный токен');
    }
    const [row] = await this.db.query(
      `SELECT session_token, used_at, expires_at, revoked_at
       FROM buyer_telegram_auth_requests
       WHERE token_hash=$1`,
      [digest(token)],
    );
    if (
      !row ||
      row.revoked_at ||
      new Date(row.expires_at).getTime() <= Date.now()
    ) {
      return { status: 'expired' as const };
    }
    if (row.used_at && row.session_token) {
      return {
        status: 'ready' as const,
        token: row.session_token as string,
      };
    }
    return { status: 'pending' as const };
  }

  async webhook(secretHeader: unknown, update: TelegramUpdate) {
    const config = telegramConfig();
    if (!config) throw new ServiceUnavailableException();
    if (typeof secretHeader !== 'string') throw new ForbiddenException();
    const provided = Buffer.from(secretHeader);
    const expected = Buffer.from(config.secret);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new ForbiddenException();
    }
    const message = update?.message;
    const user = message?.from?.id;
    const chat = message?.chat?.id;
    if (
      message?.chat?.type !== 'private' ||
      typeof user !== 'number' ||
      typeof chat !== 'number' ||
      !Number.isSafeInteger(user) ||
      !Number.isSafeInteger(chat) ||
      user !== chat ||
      message?.from?.is_bot
    ) {
      return { ok: true };
    }

    const text = message?.text;
    if (typeof text === 'string' && text.startsWith('/start ')) {
      const rawParam = text.slice(7).trim();
      if (rawParam.startsWith('auth_')) {
        const token = rawParam.slice(5).trim();
        if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return { ok: true };
        const [boundRows] = await this.db.query(
          `UPDATE buyer_telegram_auth_requests
           SET telegram_user_id=$2,chat_id=$3
           WHERE token_hash=$1 AND expires_at>now()
             AND used_at IS NULL AND revoked_at IS NULL
             AND (telegram_user_id IS NULL OR telegram_user_id=$2)
           RETURNING id`,
          [digest(token), user, chat],
        );
        const bound = Array.isArray(boundRows) ? boundRows[0] : boundRows;
        if (!bound) {
          await this.send(
            config.token,
            chat,
            'Ссылка для входа недействительна или истекла. Попробуйте снова на сайте MyStore.',
          );
          return { ok: true };
        }
        await this.send(
          config.token,
          chat,
          'Для входа в личный кабинет MyStore нажмите кнопку ниже:',
          {
            keyboard: [
              [{ text: 'Поделиться своим номером', request_contact: true }],
            ],
            one_time_keyboard: true,
            resize_keyboard: true,
          },
        );
        return { ok: true };
      }

      const token = rawParam;
      if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return { ok: true };
      const [boundRows] = await this.db.query(
        `UPDATE buyer_telegram_verifications
         SET telegram_user_id=$2,chat_id=$3
         WHERE token_hash=$1 AND expires_at>now()
           AND used_at IS NULL AND revoked_at IS NULL
           AND (telegram_user_id IS NULL OR telegram_user_id=$2)
         RETURNING id`,
        [digest(token), user, chat],
      );
      const bound = Array.isArray(boundRows) ? boundRows[0] : boundRows;
      if (!bound) {
        await this.send(
          config.token,
          chat,
          'Ссылка недействительна или истекла. Получите новую в MyStore.',
        );
        return { ok: true };
      }
      await this.send(
        config.token,
        chat,
        'Подтвердите свой номер кнопкой ниже.',
        {
          keyboard: [
            [{ text: 'Поделиться своим номером', request_contact: true }],
          ],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      );
      return { ok: true };
    }

    const contact = message?.contact;
    if (!contact) return { ok: true };
    if (contact.user_id !== user || typeof contact.phone_number !== 'string') {
      await this.send(
        config.token,
        chat,
        'Поделитесь именно своим контактом через кнопку бота.',
      );
      return { ok: true };
    }
    let phone: string;
    try {
      phone = normalizeKyrgyzPhone(contact.phone_number);
    } catch {
      await this.send(
        config.token,
        chat,
        'Номер должен быть в формате Кыргызстана +996.',
      );
      return { ok: true };
    }
    const status = await this.db.transaction(async (tx) => {
      // 1. Check if there is an active login auth request first
      const [authReq] = await tx.query(
        `SELECT id FROM buyer_telegram_auth_requests
         WHERE telegram_user_id=$1 AND chat_id=$2
           AND expires_at>now() AND used_at IS NULL AND revoked_at IS NULL
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [user, chat],
      );

      if (authReq) {
        const [other] = await tx.query(
          'SELECT id, phone_e164 FROM buyer_accounts WHERE telegram_user_id=$1',
          [user],
        );
        if (other && other.phone_e164 !== phone) {
          return 'linked_to_different_phone';
        }

        const [existingBuyer] = await tx.query(
          'SELECT id, display_name FROM buyer_accounts WHERE phone_e164=$1 FOR UPDATE',
          [phone],
        );

        let buyerId: string;
        if (existingBuyer) {
          buyerId = existingBuyer.id;
          await tx.query(
            `UPDATE buyer_accounts
             SET phone_verified_at=COALESCE(phone_verified_at,now()),
                 telegram_user_id=$2
             WHERE id=$1`,
            [buyerId, user],
          );
        } else {
          const generated = generateBuyerPassword(12);
          const pwHash = await hashPassword(generated);
          const encrypted = this.buyerAuth.encryptInitialPassword(generated);
          const [created] = await tx.query(
            `INSERT INTO buyer_accounts
             (phone_e164,display_name,password_hash,initial_password_enc,phone_verified_at,telegram_user_id)
             VALUES($1,$2,$3,$4,now(),$5)
             RETURNING id`,
            [phone, 'Покупатель', pwHash, encrypted, user],
          );
          buyerId = created.id;
        }

        await tx.query(
          `UPDATE shop_customers
           SET buyer_account_id=$1,updated_at=now()
           WHERE phone_e164=$2 AND buyer_account_id IS NULL`,
          [buyerId, phone],
        );

        const session = await this.buyerAuth.createSession(buyerId, tx);
        await tx.query(
          `UPDATE buyer_telegram_auth_requests
           SET used_at=now(), buyer_id=$2, phone_e164=$3, session_token=$4
           WHERE id=$1`,
          [authReq.id, buyerId, phone, session.token],
        );
        await tx.query(
          `UPDATE buyer_telegram_auth_requests
           SET revoked_at=now()
           WHERE telegram_user_id=$1 AND id<>$2
             AND used_at IS NULL AND revoked_at IS NULL`,
          [user, authReq.id],
        );
        return { type: 'auth_success' as const, token: session.token };
      }

      // 2. Otherwise check for verification challenge
      const [challenge] = await tx.query(
        `SELECT id,buyer_id FROM buyer_telegram_verifications
         WHERE telegram_user_id=$1 AND chat_id=$2
           AND expires_at>now() AND used_at IS NULL AND revoked_at IS NULL
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [user, chat],
      );
      if (!challenge) return 'expired';
      const [other] = await tx.query(
        'SELECT id FROM buyer_accounts WHERE telegram_user_id=$1 AND id<>$2',
        [user, challenge.buyer_id],
      );
      if (other) return 'linked';
      const [verifiedRows] = await tx.query(
        `UPDATE buyer_accounts
         SET phone_verified_at=COALESCE(phone_verified_at,now()),
             telegram_user_id=$2
         WHERE id=$1 AND phone_e164=$3
           AND (telegram_user_id IS NULL OR telegram_user_id=$2)
         RETURNING id`,
        [challenge.buyer_id, user, phone],
      );
      const verified = Array.isArray(verifiedRows)
        ? verifiedRows[0]
        : verifiedRows;
      if (!verified) return 'mismatch';
      // A verified phone belongs to this buyer. Collect customer cards from
      // all shops without exposing other people's or unverified records.
      await tx.query(
        `UPDATE shop_customers
         SET buyer_account_id=$1,updated_at=now()
         WHERE phone_e164=$2 AND buyer_account_id IS NULL`,
        [challenge.buyer_id, phone],
      );
      await tx.query(
        `UPDATE buyer_telegram_verifications
         SET used_at=now() WHERE id=$1`,
        [challenge.id],
      );
      await tx.query(
        `UPDATE buyer_telegram_verifications
         SET revoked_at=now()
         WHERE buyer_id=$1 AND id<>$2
           AND used_at IS NULL AND revoked_at IS NULL`,
        [challenge.buyer_id, challenge.id],
      );
      return 'verified';
    });
    if (typeof status === 'object' && status?.type === 'auth_success') {
      const publicBase = process.env.PUBLIC_BASE_URL || '';
      const loginLink = publicBase
        ? `${publicBase}/buyer#token=${status.token}`
        : '';
      const reply = loginLink
        ? `Вход выполнен успешно! Если вы открыли бота с компьютера, страница обновится автоматически.\n\nНа телефоне нажмите для входа: ${loginLink}`
        : 'Вход выполнен успешно! Вернитесь в браузер на сайт MyStore.';
      await this.send(config.token, chat, reply, { remove_keyboard: true });
      return { ok: true };
    }
    const messages: Record<string, string> = {
      verified:
        'Номер подтверждён. Вернитесь в кабинет MyStore и обновите статус.',
      expired: 'Ссылка истекла. Получите новую в кабинете MyStore.',
      mismatch: 'Номер контакта не совпадает с номером аккаунта MyStore.',
      linked: 'Этот Telegram уже связан с другим аккаунтом MyStore.',
      linked_to_different_phone:
        'Этот Telegram-аккаунт уже привязан к другому номеру телефона в MyStore.',
    };
    await this.send(
      config.token,
      chat,
      messages[typeof status === 'string' ? status : 'expired'] ||
        'Произошла ошибка.',
      {
        remove_keyboard: true,
      },
    );
    return { ok: true };
  }

  private async send(
    botToken: string,
    chatId: number,
    text: string,
    replyMarkup?: object,
  ) {
    // Telegram updates are retried on non-200 webhook responses; a notification
    // failure must not roll back a successfully verified phone number.
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      // The user can retry /start or check their buyer cabinet.
    }
  }
}
