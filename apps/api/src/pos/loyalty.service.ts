import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { DATABASE } from '../database';

export function loyaltyEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.LOYALTY_ENABLED === 'true'
  );
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class LoyaltyService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  ensureEnabled(): void {
    if (!loyaltyEnabled()) {
      throw new ServiceUnavailableException(
        'Бонусная программа пока недоступна',
      );
    }
  }

  async issueQr(buyerId: string) {
    this.ensureEnabled();
    const [buyer] = await this.db.query(
      'SELECT id FROM buyer_accounts WHERE id=$1 AND phone_verified_at IS NOT NULL',
      [buyerId],
    );
    if (!buyer) {
      throw new ForbiddenException('Для бонусной карты подтвердите телефон');
    }
    const token = randomBytes(32).toString('base64url');
    return this.db.transaction(async (tx) => {
      const [pending] = await tx.query(
        `SELECT count(*)::int AS count FROM buyer_loyalty_tokens
         WHERE buyer_id=$1 AND created_at>now()-interval '1 minute'`,
        [buyerId],
      );
      if (Number(pending.count) >= 10) {
        throw new ConflictException('Слишком частые запросы QR-кода');
      }
      await tx.query(
        `UPDATE buyer_loyalty_tokens SET used_at=now()
         WHERE buyer_id=$1 AND used_at IS NULL`,
        [buyerId],
      );
      const [row] = await tx.query(
        `INSERT INTO buyer_loyalty_tokens(token_hash,buyer_id,expires_at)
         VALUES ($1,$2,now()+interval '10 minutes') RETURNING expires_at`,
        [hashToken(token), buyerId],
      );
      return { token, expiresAt: row.expires_at.toISOString() };
    });
  }

  async wallets(buyerId: string) {
    this.ensureEnabled();
    const rows = await this.db.query(
      `SELECT sc.shop_id AS "shopId",s.name AS "shopName",
              COALESCE(w.balance_points,0) AS "balancePoints"
       FROM shop_customers sc
       JOIN shops s ON s.id=sc.shop_id
       LEFT JOIN loyalty_wallets w
         ON w.shop_id=sc.shop_id AND w.customer_id=sc.id
       WHERE sc.buyer_account_id=$1 ORDER BY s.name`,
      [buyerId],
    );
    return rows.map((row: any) => ({
      ...row,
      balancePoints: Number(row.balancePoints),
    }));
  }

  async purchases(buyerId: string) {
    const rows = await this.db.query(
      `WITH buyer_sales AS (
         SELECT DISTINCT sc.shop_id, ll.sale_id
         FROM shop_customers sc
         JOIN loyalty_ledger ll
           ON ll.shop_id = sc.shop_id AND ll.customer_id = sc.id
         WHERE sc.buyer_account_id = $1
         UNION
         SELECT DISTINCT sc.shop_id, cs.document_id AS sale_id
         FROM shop_customers sc
         JOIN credit_sales cs
           ON cs.shop_id = sc.shop_id AND cs.customer_id = sc.id
         WHERE sc.buyer_account_id = $1
       )
       SELECT
         d.id AS "saleId",
         d.shop_id AS "shopId",
         s.name AS "shopName",
         d.total_minor AS "totalMinor",
         d.created_at AS "createdAt",
         pr.method AS "method",
         (cs.document_id IS NOT NULL) AS "isCredit",
         COALESCE((
           SELECT SUM(ll.points)
           FROM loyalty_ledger ll
           JOIN shop_customers sc ON sc.id = ll.customer_id AND sc.shop_id = ll.shop_id
           WHERE ll.shop_id = d.shop_id AND ll.sale_id = d.id
             AND sc.buyer_account_id = $1 AND ll.kind = 'earned'
         ), 0) AS "earnedPoints",
         COALESCE((
           SELECT SUM(ll.points)
           FROM loyalty_ledger ll
           JOIN shop_customers sc ON sc.id = ll.customer_id AND sc.shop_id = ll.shop_id
           WHERE ll.shop_id = d.shop_id AND ll.sale_id = d.id
             AND sc.buyer_account_id = $1 AND ll.kind = 'redeemed'
         ), 0) AS "spentPoints"
       FROM buyer_sales bs
       JOIN stock_documents d
         ON d.shop_id = bs.shop_id AND d.id = bs.sale_id AND d.kind = 'sale'
       JOIN shops s ON s.id = d.shop_id
       LEFT JOIN payment_records pr
         ON pr.shop_id = d.shop_id AND pr.document_id = d.id AND pr.kind = 'sale'
       LEFT JOIN credit_sales cs
         ON cs.shop_id = d.shop_id AND cs.document_id = d.id
       ORDER BY d.created_at DESC
       LIMIT 50`,
      [buyerId],
    );
    if (!rows.length) return [];
    const saleIds = rows.map((r: any) => r.saleId);
    const lineRows = await this.db.query(
      `SELECT document_id AS "saleId", name, quantity,
              unit_price_minor AS "unitPriceMinor",
              COALESCE(discount_minor, 0) AS "discountMinor"
       FROM sale_lines
       WHERE document_id = ANY($1)
       ORDER BY id`,
      [saleIds],
    );
    const linesBySale = new Map<string, any[]>();
    for (const line of lineRows) {
      const list = linesBySale.get(line.saleId) ?? [];
      list.push({
        name: line.name,
        quantity: Number(line.quantity),
        unitPriceMinor: Number(line.unitPriceMinor),
        discountMinor: Number(line.discountMinor ?? 0),
      });
      linesBySale.set(line.saleId, list);
    }
    return rows.map((row: any) => ({
      saleId: row.saleId,
      shopId: row.shopId,
      shopName: row.shopName,
      totalMinor: Number(row.totalMinor),
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      method: row.method ?? null,
      isCredit: Boolean(row.isCredit),
      earnedPoints: Number(row.earnedPoints ?? 0),
      spentPoints: Number(row.spentPoints ?? 0),
      lines: linesBySale.get(row.saleId) ?? [],
    }));
  }

  async lookupByQr(shopId: string, token: string) {
    this.ensureEnabled();
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new BadRequestException('Некорректный QR-код покупателя');
    }
    const [qr] = await this.db.query(
      `SELECT t.buyer_id, b.phone_e164, b.display_name
       FROM buyer_loyalty_tokens t
       JOIN buyer_accounts b ON b.id=t.buyer_id
       WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>now()`,
      [hashToken(token)],
    );
    if (!qr) {
      throw new BadRequestException('QR-код истёк или уже использован');
    }
    const [customer] = await this.db.query(
      `SELECT sc.id, sc.display_name AS name, sc.phone_e164 AS phone,
              COALESCE(w.balance_points,0) AS "bonusPoints"
       FROM shop_customers sc
       LEFT JOIN loyalty_wallets w
         ON w.shop_id=sc.shop_id AND w.customer_id=sc.id
       WHERE sc.shop_id=$1 AND (sc.buyer_account_id=$2 OR sc.phone_e164=$3)
       ORDER BY (sc.buyer_account_id=$2) DESC
       LIMIT 1`,
      [shopId, qr.buyer_id, qr.phone_e164],
    );
    if (!customer) {
      return {
        customerId: '',
        name: qr.display_name || 'Покупатель',
        phone: qr.phone_e164 ?? '',
        bonusPoints: 0,
        totalDebtMinor: 0,
        openDebts: [],
      };
    }
    const openDebts = await this.db.query(
      `SELECT document_id AS "saleId",total_minor AS "totalMinor",
              paid_minor AS "paidMinor",
              (total_minor-paid_minor) AS "debtMinor",
              due_on AS "dueOn",created_at AS "createdAt"
       FROM credit_sales
       WHERE shop_id=$1 AND customer_id=$2 AND total_minor>paid_minor
       ORDER BY created_at ASC`,
      [shopId, customer.id],
    );
    const mappedDebts = openDebts.map((row: any) => ({
      saleId: row.saleId,
      totalMinor: Number(row.totalMinor),
      paidMinor: Number(row.paidMinor),
      debtMinor: Number(row.debtMinor),
      dueOn:
        row.dueOn instanceof Date
          ? row.dueOn.toISOString().slice(0, 10)
          : String(row.dueOn),
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
    }));
    const totalDebtMinor = mappedDebts.reduce(
      (sum: number, item: { debtMinor: number }) => sum + item.debtMinor,
      0,
    );
    return {
      customerId: customer.id,
      name: customer.name || qr.display_name || 'Покупатель',
      phone: customer.phone ?? qr.phone_e164 ?? '',
      bonusPoints: Number(customer.bonusPoints),
      totalDebtMinor,
      openDebts: mappedDebts,
    };
  }

  async applyToSale(
    tx: EntityManager,
    input: {
      shopId: string;
      token: string;
      redeemPoints: number;
      saleId: string;
      totalMinor: number;
    },
  ) {
    this.ensureEnabled();
    if (!/^[A-Za-z0-9_-]{43}$/.test(input.token)) {
      throw new BadRequestException('Некорректный QR-код покупателя');
    }
    if (!Number.isSafeInteger(input.redeemPoints) || input.redeemPoints < 0) {
      throw new BadRequestException('Некорректное количество баллов');
    }
    const [card] = await tx.query(
      `SELECT t.buyer_id, b.phone_e164, b.display_name
       FROM buyer_loyalty_tokens t
       JOIN buyer_accounts b ON b.id=t.buyer_id
       WHERE t.token_hash=$1 AND t.used_at IS NULL
         AND t.expires_at>now() AND b.phone_verified_at IS NOT NULL
       FOR UPDATE OF t`,
      [hashToken(input.token)],
    );
    if (!card) {
      throw new ConflictException(
        'QR-код истёк, использован или не подтверждён',
      );
    }
    let [customer] = await tx.query(
      `SELECT id FROM shop_customers
       WHERE shop_id=$1 AND (buyer_account_id=$2 OR phone_e164=$3)
       LIMIT 1`,
      [input.shopId, card.buyer_id, card.phone_e164],
    );
    if (customer) {
      await tx.query(
        `UPDATE shop_customers
         SET buyer_account_id=$2, updated_at=now()
         WHERE id=$1 AND buyer_account_id IS DISTINCT FROM $2`,
        [customer.id, card.buyer_id],
      );
    } else {
      const [membership] = await tx.query(
        `SELECT user_id FROM memberships WHERE shop_id=$1 ORDER BY CASE role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END LIMIT 1`,
        [input.shopId],
      );
      const [created] = await tx.query(
        `INSERT INTO shop_customers(shop_id, phone_e164, display_name, buyer_account_id, created_by)
         VALUES($1, $2, $3, $4, $5)
         ON CONFLICT (shop_id, phone_e164) DO UPDATE
           SET buyer_account_id=EXCLUDED.buyer_account_id, updated_at=now()
         RETURNING id`,
        [
          input.shopId,
          card.phone_e164,
          card.display_name || 'Покупатель',
          card.buyer_id,
          membership?.user_id,
        ],
      );
      customer = created;
    }
    await tx.query(
      `INSERT INTO loyalty_wallets(shop_id,customer_id)
       VALUES($1,$2) ON CONFLICT DO NOTHING`,
      [input.shopId, customer.id],
    );
    const [wallet] = await tx.query(
      `SELECT balance_points FROM loyalty_wallets
       WHERE shop_id=$1 AND customer_id=$2 FOR UPDATE`,
      [input.shopId, customer.id],
    );
    const current = BigInt(wallet.balance_points);
    const spent = BigInt(input.redeemPoints);
    const total = BigInt(input.totalMinor);
    if (spent > current) {
      throw new ConflictException('Недостаточно бонусных баллов');
    }
    // One point covers one som. Redemption is limited to 20% of the sale.
    if (spent * 100n > total / 5n) {
      throw new BadRequestException('Баллами можно оплатить до 20% покупки');
    }
    const cashMinor = total - spent * 100n;
    // One earned point for each 100 som paid with cash/card (1%).
    const earned = cashMinor / 10000n;
    const balance = current - spent + earned;
    if (balance > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new BadRequestException('Превышен допустимый баланс баллов');
    }
    if (spent > 0n) {
      await tx.query(
        `INSERT INTO loyalty_ledger(id,shop_id,customer_id,sale_id,kind,points)
         VALUES($1,$2,$3,$4,'redeemed',$5)`,
        [randomUUID(), input.shopId, customer.id, input.saleId, Number(spent)],
      );
    }
    if (earned > 0n) {
      await tx.query(
        `INSERT INTO loyalty_ledger(id,shop_id,customer_id,sale_id,kind,points)
         VALUES($1,$2,$3,$4,'earned',$5)`,
        [randomUUID(), input.shopId, customer.id, input.saleId, Number(earned)],
      );
    }
    await tx.query(
      `UPDATE loyalty_wallets SET balance_points=$3
       WHERE shop_id=$1 AND customer_id=$2`,
      [input.shopId, customer.id, Number(balance)],
    );
    await tx.query(
      'UPDATE buyer_loyalty_tokens SET used_at=now() WHERE token_hash=$1',
      [hashToken(input.token)],
    );
    return {
      cashMinor: Number(cashMinor),
      earnedPoints: Number(earned),
      spentPoints: Number(spent),
      balancePoints: Number(balance),
    };
  }
}
