import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
import { normalizeKyrgyzPhone } from './kyrgyz-phone';

@Injectable()
export class ShopCustomersService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  async list(shopId: string, query: string, page: number, pageSize: number) {
    const term = query.trim();
    const phone = term
      ? (() => {
          try {
            return normalizeKyrgyzPhone(term);
          } catch {
            return null;
          }
        })()
      : null;
    const where = `shop_id=$1 AND (
      $2::text='' OR lower(display_name) LIKE '%' || lower($2) || '%'
      OR phone_e164=$3 OR ($4::text<>'' AND phone_e164 LIKE '%' || $4 || '%')
    )`;
    const args = [shopId, term, phone, term.replace(/\D/g, '')];
    const [count] = await this.db.query(
      `SELECT count(*)::int AS total FROM shop_customers WHERE ${where}`,
      args,
    );
    const rows = await this.db.query(
      `SELECT id,display_name AS "name",phone_e164 AS phone,address,
        created_at AS "createdAt",buyer_account_id IS NOT NULL AS "linked",credit_approved AS "creditApproved",credit_limit_minor AS "creditLimitMinor"
       FROM shop_customers WHERE ${where}
       ORDER BY created_at DESC,id DESC LIMIT $5 OFFSET $6`,
      [...args, pageSize, (page - 1) * pageSize],
    );
    return { items: rows, total: count.total, page, pageSize };
  }

  /**
   * Cross-shop directory returns only identity, never cross-shop debt,
   * addresses, bonuses, purchases or account verification secrets.
   * Search is opt-in and requires a nontrivial query.
   */
  async directory(shopId: string, query: string) {
    const term = query.trim();
    if (term.length < 3) return { items: [] };
    const digits = term.replace(/\D/g, '');
    const phone = (() => {
      try {
        return normalizeKyrgyzPhone(term);
      } catch {
        return null;
      }
    })();
    const rows = await this.db.query(
      `WITH directory AS (
        SELECT phone_e164, display_name, created_at FROM shop_customers
        UNION ALL
        SELECT phone_e164, display_name, created_at FROM buyer_accounts
      ), matches AS (
        SELECT DISTINCT ON (phone_e164)
          phone_e164, display_name
        FROM directory
        WHERE lower(display_name) LIKE '%' || lower($2::text) || '%'
          OR phone_e164=$3
          OR ($4::text<>'' AND phone_e164 LIKE '%' || $4 || '%')
        ORDER BY phone_e164, created_at DESC
      )
      SELECT m.phone_e164 AS phone,
        COALESCE(local.display_name,m.display_name) AS name,
        local.id, local.buyer_account_id IS NOT NULL AS linked,
        local.id IS NOT NULL AS "isLocal"
      FROM matches m
      LEFT JOIN shop_customers local ON local.shop_id=$1 AND local.phone_e164=m.phone_e164
      ORDER BY (local.id IS NOT NULL) DESC, name ASC LIMIT 20`,
      [shopId, term, phone, digits],
    );
    return { items: rows };
  }

  /** A global identity only becomes a shop customer when a cashier selects it. */
  async resolve(
    shopId: string,
    actorId: string,
    phoneInput: string,
    nameInput: string,
  ) {
    const phone = normalizeKyrgyzPhone(phoneInput);
    const name = nameInput.trim().replace(/\\s+/g, ' ');
    if (name.length < 2 || name.length > 120)
      throw new BadRequestException('Укажите имя (2–120 символов)');
    const [row] = await this.db.query(
      `INSERT INTO shop_customers
       (shop_id,phone_e164,display_name,created_by,buyer_account_id)
       VALUES($1,$2,$3,$4,
         (SELECT id FROM buyer_accounts
          WHERE phone_e164=$2 AND phone_verified_at IS NOT NULL))
       ON CONFLICT (shop_id,phone_e164)
       DO UPDATE SET updated_at=shop_customers.updated_at
       RETURNING id,display_name AS "name",phone_e164 AS phone,
         buyer_account_id IS NOT NULL AS linked`,
      [shopId, phone, name, actorId],
    );
    return row;
  }

  async create(
    shopId: string,
    actorId: string,
    phoneInput: string,
    nameInput: string,
    address?: string,
  ) {
    const phone = normalizeKyrgyzPhone(phoneInput);
    const name = nameInput.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 120) {
      throw new BadRequestException('Укажите имя (2–120 символов)');
    }
    const cleanAddress = address?.trim() || null;
    try {
      const [row] = await this.db.query(
        `INSERT INTO shop_customers
         (shop_id,phone_e164,display_name,address,created_by,buyer_account_id)
         VALUES($1,$2::text,$3,$4,$5,
           (SELECT id FROM buyer_accounts
            WHERE phone_e164=$2::text AND phone_verified_at IS NOT NULL))
         RETURNING id,display_name AS "name",phone_e164 AS phone,address,
           created_at AS "createdAt",
           buyer_account_id IS NOT NULL AS "linked"`,
        [shopId, phone, name, cleanAddress, actorId],
      );
      return row;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(
          'Клиент с этим номером уже есть в магазине',
        );
      }
      throw error;
    }
  }

  async setCreditPolicy(
    shopId: string,
    id: string,
    approved: boolean,
    limitMinor: number,
  ) {
    const [row] = await this.db.query(
      `UPDATE shop_customers SET credit_approved=$3,credit_limit_minor=$4,updated_at=now()
       WHERE shop_id=$1 AND id=$2
       RETURNING id,credit_approved AS "creditApproved",
       credit_limit_minor AS "creditLimitMinor"`,
      [shopId, id, approved, approved ? limitMinor : 0],
    );
    if (!row) throw new NotFoundException('Клиент не найден');
    return { ...row, creditLimitMinor: Number(row.creditLimitMinor) };
  }

  async get(shopId: string, id: string) {
    const [row] = await this.db.query(
      `SELECT id,display_name AS "name",phone_e164 AS phone,address,
       created_at AS "createdAt",buyer_account_id IS NOT NULL AS "linked"
       FROM shop_customers WHERE shop_id=$1 AND id=$2`,
      [shopId, id],
    );
    if (!row) throw new NotFoundException();
    return row;
  }
}
