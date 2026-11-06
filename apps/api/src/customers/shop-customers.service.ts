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
      OR phone_e164=$3 OR phone_e164 LIKE '%' || $4 || '%'
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
        `INSERT INTO shop_customers(shop_id,phone_e164,display_name,address,created_by)
         VALUES($1,$2,$3,$4,$5)
         RETURNING id,display_name AS "name",phone_e164 AS phone,address,
           created_at AS "createdAt"`,
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
