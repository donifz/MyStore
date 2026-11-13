import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatMoney(minor: number | bigint): string {
  const n = Number(minor) / 100;
  return (
    n.toLocaleString('ru-RU', {
      minimumFractionDigits: n % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }) + ' сом'
  );
}

function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const username = process.env.TELEGRAM_BOT_USERNAME ?? '';
  if (!token || !username) {
    return null;
  }
  return { token, username };
}

@Injectable()
export class ShopTelegramService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  config() {
    const config = telegramConfig();
    return {
      enabled: !!config,
      botUsername: config?.username ?? null,
    };
  }

  async getStatus(shopId: string) {
    const config = telegramConfig();
    const [sub] = await this.db.query(
      `SELECT chat_id, telegram_user_id, username, first_name, daily_shift_summary, created_at
       FROM shop_telegram_subscriptions
       WHERE shop_id=$1
       ORDER BY created_at DESC
       LIMIT 1`,
      [shopId],
    );
    return {
      enabled: !!config,
      botUsername: config?.username ?? null,
      subscription: sub
        ? {
            chatId: String(sub.chat_id),
            telegramUserId: sub.telegram_user_id
              ? String(sub.telegram_user_id)
              : null,
            username: sub.username ?? null,
            firstName: sub.first_name ?? null,
            dailyShiftSummary: !!sub.daily_shift_summary,
            createdAt: sub.created_at,
          }
        : null,
    };
  }

  async createLinkToken(shopId: string, userId: string) {
    const config = telegramConfig();
    if (!config) {
      throw new BadRequestException('Telegram бот не настроен на сервере');
    }
    const token = randomBytes(24).toString('base64url');
    await this.db.query(
      `INSERT INTO shop_telegram_link_tokens
       (shop_id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, now() + interval '15 minutes')`,
      [shopId, userId, digest(token)],
    );
    return {
      url: `https://t.me/${config.username}?start=owner_${token}`,
      expiresIn: 900,
    };
  }

  async handleOwnerStart(
    userId: number,
    chatId: number,
    username?: string,
    firstName?: string,
    token?: string,
  ): Promise<boolean> {
    const config = telegramConfig();
    if (!config || !token || !/^[A-Za-z0-9_-]{32}$/.test(token)) {
      return false;
    }
    const tokenHash = digest(token);
    const [tokenRow] = await this.db.query(
      `SELECT t.id, t.shop_id, t.user_id, s.name as shop_name
       FROM shop_telegram_link_tokens t
       JOIN shops s ON s.id = t.shop_id
       WHERE t.token_hash = $1
         AND t.expires_at > now()
         AND t.used_at IS NULL
       LIMIT 1`,
      [tokenHash],
    );
    if (!tokenRow) {
      await this.sendRaw(
        config.token,
        chatId,
        '⚠️ <b>Ссылка для подключения устарела или уже была использована.</b>\n\nПожалуйста, сгенерируйте новую ссылку в панели управления магазином (раздел «Настройки / Уведомления»).',
      );
      return true;
    }

    await this.db.transaction(async (tx) => {
      await tx.query(
        'UPDATE shop_telegram_link_tokens SET used_at = now() WHERE id = $1',
        [tokenRow.id],
      );
      await tx.query(
        `INSERT INTO shop_telegram_subscriptions
         (shop_id, chat_id, telegram_user_id, username, first_name, daily_shift_summary, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, now())
         ON CONFLICT (shop_id, chat_id)
         DO UPDATE SET
           telegram_user_id = EXCLUDED.telegram_user_id,
           username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           daily_shift_summary = true,
           updated_at = now()`,
        [tokenRow.shop_id, chatId, userId, username || null, firstName || null],
      );
    });

    const shopTitle = escapeHtml(tokenRow.shop_name || 'Магазин');
    const welcome =
      `✅ <b>Telegram успешно подключён к магазину «${shopTitle}»!</b>\n\n` +
      `Теперь при каждом закрытии кассовой смены вам будет мгновенно приходить подробная сводка:\n` +
      `• 💰 <b>Выручка за смену</b> (наличные / безнал)\n` +
      `• 📈 <b>Чистая прибыль</b> (с учётом расходов)\n` +
      `• 💸 <b>Расходы кассы</b> с детализацией по статьям\n` +
      `• 💵 <b>Фактический остаток наличности</b> в кассе\n` +
      `• 🏆 <b>Топ-5 проданных товаров</b>\n\n` +
      `<i>Управлять уведомлениями вы можете в панели управления MyStore.</i>`;

    await this.sendRaw(config.token, chatId, welcome);
    return true;
  }

  async manualSubscribe(shopId: string, chatIdInput: string | number) {
    const config = telegramConfig();
    const chatIdNum =
      typeof chatIdInput === 'number'
        ? chatIdInput
        : parseInt(chatIdInput.trim(), 10);
    if (!Number.isSafeInteger(chatIdNum)) {
      throw new BadRequestException('Некорректный Chat ID');
    }
    await this.db.query(
      `INSERT INTO shop_telegram_subscriptions
       (shop_id, chat_id, daily_shift_summary, updated_at)
       VALUES ($1, $2, true, now())
       ON CONFLICT (shop_id, chat_id)
       DO UPDATE SET daily_shift_summary = true, updated_at = now()`,
      [shopId, chatIdNum],
    );
    if (config) {
      const [shop] = await this.db.query('SELECT name FROM shops WHERE id=$1', [
        shopId,
      ]);
      const shopTitle = escapeHtml(shop?.name || 'Магазин');
      await this.sendRaw(
        config.token,
        chatIdNum,
        `✅ <b>Telegram-уведомления подключены для магазина «${shopTitle}».</b>\n\nЕжедневные отчёты по закрытию смен будут поступать в этот чат.`,
      );
    }
    return { ok: true, chatId: String(chatIdNum) };
  }

  async unsubscribe(shopId: string) {
    await this.db.query(
      'DELETE FROM shop_telegram_subscriptions WHERE shop_id=$1',
      [shopId],
    );
    return { ok: true };
  }

  async sendTestSummary(shopId: string) {
    const config = telegramConfig();
    if (!config) {
      throw new BadRequestException('Telegram бот не настроен');
    }
    const [sub] = await this.db.query(
      `SELECT chat_id FROM shop_telegram_subscriptions
       WHERE shop_id=$1 AND daily_shift_summary=true
       LIMIT 1`,
      [shopId],
    );
    if (!sub) {
      throw new BadRequestException('Telegram не подключён к этому магазину');
    }
    // Find latest closed shift or generate realistic test summary
    const [latestShift] = await this.db.query(
      `SELECT id FROM cash_shifts
       WHERE shop_id=$1 AND closed_at IS NOT NULL
       ORDER BY closed_at DESC
       LIMIT 1`,
      [shopId],
    );
    if (latestShift?.id) {
      await this.sendShiftCloseSummary(
        shopId,
        latestShift.id,
        sub.chat_id,
        true,
      );
    } else {
      const [shop] = await this.db.query('SELECT name FROM shops WHERE id=$1', [
        shopId,
      ]);
      const shopTitle = escapeHtml(shop?.name || 'Магазин');
      const testMsg =
        `📊 <b>Тестовая сводка закрытия смены • ${shopTitle}</b>\n` +
        `🗓 <i>Тестовое уведомление</i>\n` +
        `👤 Кассир: <b>Тестовый кассир</b>\n\n` +
        `💰 <b>Выручка:</b> 25 400 сом\n` +
        `  ├ 💵 Наличные: 17 000 сом\n` +
        `  └ 💳 Карта / QR: 8 400 сом\n\n` +
        `📈 <b>Чистая прибыль:</b> 9 600 сом\n` +
        `  <i>(Маржа: 11 800 сом − Расходы: 2 200 сом)</i>\n\n` +
        `💸 <b>Расходы из кассы:</b> 2 200 сом\n` +
        `  ├ Закупка упаковки: 1 500 сом\n` +
        `  └ Хозтовары: 700 сом\n\n` +
        `💵 <b>В кассе на конец смены:</b>\n` +
        `  • Фактически: <b>24 800 сом</b> (ожидалось: 24 800 сом)\n` +
        `  • Сходимость: Совпадает без расхождений ✅\n\n` +
        `🏆 <b>Топ проданных товаров:</b>\n` +
        `1. Популярный товар А — 12 шт. (6 000 сом)\n` +
        `2. Популярный товар Б — 8 шт. (4 400 сом)\n\n` +
        `✅ <i>Связь с Telegram работает отлично!</i>`;
      await this.sendRaw(config.token, sub.chat_id, testMsg);
    }
    return { ok: true };
  }

  async sendShiftCloseSummary(
    shopId: string,
    shiftId: string,
    targetChatId?: number | string,
    isTest = false,
  ) {
    const config = telegramConfig();
    if (!config) return;

    let recipients: Array<{ chat_id: number | string }> = [];
    if (targetChatId) {
      recipients = [{ chat_id: targetChatId }];
    } else {
      recipients = await this.db.query(
        `SELECT chat_id FROM shop_telegram_subscriptions
         WHERE shop_id=$1 AND daily_shift_summary=true`,
        [shopId],
      );
    }
    if (!recipients.length) return;

    try {
      const [shop] = await this.db.query('SELECT name FROM shops WHERE id=$1', [
        shopId,
      ]);
      const [shift] = await this.db.query(
        `SELECT s.*, u.display_name, u.email
         FROM cash_shifts s
         LEFT JOIN users u ON u.id = s.actor_id
         WHERE s.shop_id=$1 AND s.id=$2`,
        [shopId, shiftId],
      );
      if (!shift) return;

      const [payments] = await this.db.query(
        `SELECT
           COALESCE(sum(amount_minor) FILTER (WHERE kind='sale' AND method='cash'),0) AS sc,
           COALESCE(sum(amount_minor) FILTER (WHERE kind='sale' AND method='card'),0) AS sd,
           COALESCE(sum(amount_minor) FILTER (WHERE kind='refund' AND method='cash'),0) AS rc,
           COALESCE(sum(amount_minor) FILTER (WHERE kind='refund' AND method='card'),0) AS rd
         FROM payment_records
         WHERE shop_id=$1 AND shift_id=$2`,
        [shopId, shiftId],
      );

      const [repayments] = await this.db.query(
        `SELECT
           COALESCE(sum(amount_minor) FILTER (WHERE method='cash'),0) AS cash,
           COALESCE(sum(amount_minor) FILTER (WHERE method='card'),0) AS card
         FROM credit_repayments
         WHERE shop_id=$1 AND shift_id=$2`,
        [shopId, shiftId],
      );

      // Cost of goods sold for this shift
      const [costRow] = await this.db.query(
        `SELECT
           COALESCE(sum(sl.cost_minor), 0) AS sold_cost
         FROM pos_sales ps
         JOIN sale_lines sl ON sl.shop_id = ps.shop_id AND sl.document_id = ps.document_id
         WHERE ps.shop_id = $1 AND ps.shift_id = $2`,
        [shopId, shiftId],
      );

      // Expenses during this shift
      const expenseRows = await this.db.query(
        `SELECT reason, sum(amount_minor) AS total_minor
         FROM cash_transactions
         WHERE shop_id=$1 AND shift_id=$2 AND type='out'
         GROUP BY reason
         ORDER BY total_minor DESC`,
        [shopId, shiftId],
      );

      // Top 5 products sold in this shift
      const topProducts = await this.db.query(
        `SELECT
           v.name,
           COALESCE(sum(sl.quantity), 0)::int AS qty,
           COALESCE(sum(sl.quantity * sl.unit_price_minor), 0) AS revenue_minor
         FROM pos_sales ps
         JOIN sale_lines sl ON sl.shop_id = ps.shop_id AND sl.document_id = ps.document_id
         JOIN variants v ON v.shop_id = sl.shop_id AND v.id = sl.variant_id
         WHERE ps.shop_id = $1 AND ps.shift_id = $2
         GROUP BY v.name
         ORDER BY qty DESC, revenue_minor DESC
         LIMIT 5`,
        [shopId, shiftId],
      );

      const salesCash = BigInt(payments?.sc || 0);
      const salesCard = BigInt(payments?.sd || 0);
      const refundsCash = BigInt(payments?.rc || 0);
      const refundsCard = BigInt(payments?.rd || 0);
      const creditCash = BigInt(repayments?.cash || 0);
      const creditCard = BigInt(repayments?.card || 0);

      const totalCashRevenue = salesCash + creditCash - refundsCash;
      const totalCardRevenue = salesCard + creditCard - refundsCard;
      const totalRevenue = totalCashRevenue + totalCardRevenue;

      const soldCost = BigInt(costRow?.sold_cost || 0);
      const grossMargin =
        totalRevenue > soldCost ? totalRevenue - soldCost : 0n;

      const totalExpensesMinor = expenseRows.reduce(
        (sum: bigint, r: any) => sum + BigInt(r.total_minor),
        0n,
      );
      const netProfitMinor =
        grossMargin > totalExpensesMinor
          ? grossMargin - totalExpensesMinor
          : 0n;

      const actualCash = BigInt(shift.actual_cash_minor ?? 0);
      const expectedCash = BigInt(shift.expected_cash_minor ?? 0);
      const discrepancy = actualCash - expectedCash;

      const shopName = escapeHtml(shop?.name || 'Магазин');
      const cashierName = escapeHtml(
        shift.display_name || shift.email || 'Кассир',
      );

      const openedAt = new Date(shift.opened_at);
      const closedAt = shift.closed_at ? new Date(shift.closed_at) : new Date();

      const timeOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Bishkek',
        hour: '2-digit',
        minute: '2-digit',
      };
      const dateOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Bishkek',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      };

      const dateStr = closedAt.toLocaleDateString('ru-RU', dateOptions);
      const timeStr = `${openedAt.toLocaleTimeString('ru-RU', timeOptions)} – ${closedAt.toLocaleTimeString('ru-RU', timeOptions)}`;

      let text =
        `📊 <b>${isTest ? '[ТЕСТ] ' : ''}Сводка закрытия смены • ${shopName}</b>\n` +
        `🗓 <i>${dateStr}</i>\n` +
        `👤 Кассир: <b>${cashierName}</b>\n` +
        `⏱ Время работы: ${timeStr}\n\n`;

      // Revenue
      text +=
        `💰 <b>Выручка за смену:</b> ${formatMoney(totalRevenue)}\n` +
        `  ├ 💵 Наличные: ${formatMoney(totalCashRevenue)}\n` +
        `  └ 💳 Безнал / QR: ${formatMoney(totalCardRevenue)}\n\n`;

      // Net profit
      text +=
        `📈 <b>Чистая прибыль:</b> ${formatMoney(netProfitMinor)}\n` +
        `  <i>(Маржа: ${formatMoney(grossMargin)} − Расходы: ${formatMoney(totalExpensesMinor)})</i>\n\n`;

      // Expenses breakdown
      text += `💸 <b>Расходы из кассы:</b> ${formatMoney(totalExpensesMinor)}\n`;
      if (expenseRows.length === 0) {
        text += `  <i>Расходов за смену не зафиксировано</i>\n\n`;
      } else {
        expenseRows.forEach((r: any, idx: number) => {
          const isLast = idx === expenseRows.length - 1;
          const prefix = isLast ? '  └' : '  ├';
          text += `${prefix} ${escapeHtml(r.reason)}: <b>${formatMoney(r.total_minor)}</b>\n`;
        });
        text += '\n';
      }

      // Cash in register & discrepancy
      let discrepancyStatus = 'Совпадает без расхождений ✅';
      if (discrepancy > 0n) {
        discrepancyStatus = `Излишек: +${formatMoney(discrepancy)} ⚠️`;
      } else if (discrepancy < 0n) {
        discrepancyStatus = `Недостача: ${formatMoney(discrepancy)} ❗️`;
      }

      text +=
        `💵 <b>В кассе на конец смены:</b>\n` +
        `  • Фактически: <b>${formatMoney(actualCash)}</b>\n` +
        `  • Ожидалось: ${formatMoney(expectedCash)}\n` +
        `  • Сходимость: ${discrepancyStatus}\n`;

      if (shift.comment) {
        text += `  • Комментарий кассира: <i>${escapeHtml(shift.comment)}</i>\n`;
      }
      text += '\n';

      // Top 5 products
      if (topProducts.length > 0) {
        text += `🏆 <b>Топ-5 проданных товаров:</b>\n`;
        topProducts.forEach((p: any, idx: number) => {
          text += `${idx + 1}. <b>${escapeHtml(p.name)}</b> — ${p.qty} шт. (${formatMoney(p.revenue_minor)})\n`;
        });
      }

      // Dispatch to each recipient
      for (const r of recipients) {
        await this.sendRaw(config.token, r.chat_id, text);
      }
    } catch (err) {
      console.warn('[shop-telegram] failed to send shift summary:', err);
    }
  }

  private async sendRaw(
    botToken: string,
    chatId: number | string,
    htmlText: string,
  ) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: htmlText,
            parse_mode: 'HTML',
          }),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok) {
        const errText = await res.text();
        console.warn(
          `[shop-telegram] telegram sendMessage error (${res.status}):`,
          errText,
        );
      }
    } catch (e) {
      console.warn('[shop-telegram] telegram network error:', e);
    }
  }
}
