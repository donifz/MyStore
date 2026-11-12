import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { hashPassword } from '../auth/password';
import { DATABASE } from '../database';
import { BuyerAuthService, generateBuyerPassword } from './buyer-auth.service';

function digest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class BuyerInvitesService {
  constructor(
    @Inject(DATABASE) private readonly db: DataSource,
    private readonly buyerAuth: BuyerAuthService,
  ) {}

  async issue(shopId: string, customerId: string, actorId: string) {
    return this.db.transaction(async (tx) => {
      // Serializes issuance with acceptance and customer-link modifications.
      const [customer] = await tx.query(
        `SELECT id,buyer_account_id,display_name,phone_e164
         FROM shop_customers
         WHERE shop_id=$1 AND id=$2 FOR UPDATE`,
        [shopId, customerId],
      );
      if (!customer) throw new NotFoundException('Клиент не найден');
      if (customer.buyer_account_id)
        throw new ConflictException('Клиент уже привязан к кабинету');

      await tx.query(
        `UPDATE shop_customer_invitations
         SET revoked_at=now()
         WHERE shop_id=$1 AND customer_id=$2
           AND accepted_at IS NULL AND revoked_at IS NULL`,
        [shopId, customerId],
      );

      const token = randomBytes(32).toString('base64url');
      const [invitation] = await tx.query(
        `INSERT INTO shop_customer_invitations
         (shop_id,customer_id,token_hash,issued_by,expires_at)
         VALUES($1,$2,$3,$4,now()+interval '15 minutes')
         RETURNING expires_at`,
        [shopId, customerId, digest(token), actorId],
      );
      // Token is shown exactly once; never store it in cleartext or logs.
      return {
        token,
        expiresAt: invitation.expires_at.toISOString(),
        customerName: customer.display_name,
        phone: customer.phone_e164,
      };
    });
  }

  async accept(buyerId: string, token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new BadRequestException('Недействительный код приглашения');
    const hash = digest(token);
    return this.db.transaction(async (tx) => {
      // Lock the customer first to use the same ordering as issuance. An
      // invitation cannot be retargeted: customer/shop are immutable.
      const [candidate] = await tx.query(
        `SELECT shop_id,customer_id FROM shop_customer_invitations
         WHERE token_hash=$1`,
        [hash],
      );
      if (!candidate)
        throw new BadRequestException('Недействительный код приглашения');

      const [customer] = await tx.query(
        `SELECT phone_e164,buyer_account_id
         FROM shop_customers WHERE shop_id=$1 AND id=$2 FOR UPDATE`,
        [candidate.shop_id, candidate.customer_id],
      );
      if (!customer) throw new NotFoundException('Клиент не найден');

      const [invitation] = await tx.query(
        `SELECT id,expires_at,accepted_at,revoked_at
         FROM shop_customer_invitations
         WHERE token_hash=$1 FOR UPDATE`,
        [hash],
      );
      if (
        !invitation ||
        invitation.revoked_at ||
        invitation.accepted_at ||
        new Date(invitation.expires_at).getTime() <= Date.now()
      ) {
        throw new ConflictException('Код уже использован или истёк');
      }

      const [buyer] = await tx.query(
        'SELECT phone_e164 FROM buyer_accounts WHERE id=$1 FOR UPDATE',
        [buyerId],
      );
      if (!buyer || buyer.phone_e164 !== customer.phone_e164) {
        throw new ForbiddenException(
          'Номер в кабинете не совпадает с номером клиента магазина',
        );
      }
      if (customer.buyer_account_id) {
        throw new ConflictException('Клиент уже привязан к кабинету');
      }

      await tx.query(
        `UPDATE shop_customers
         SET buyer_account_id=$3,updated_at=now()
         WHERE shop_id=$1 AND id=$2 AND buyer_account_id IS NULL`,
        [candidate.shop_id, candidate.customer_id, buyerId],
      );
      await tx.query(
        `UPDATE shop_customer_invitations
         SET accepted_at=now(),accepted_by=$2
         WHERE id=$1`,
        [invitation.id, buyerId],
      );
      await tx.query(
        `UPDATE shop_customer_invitations SET revoked_at=now()
         WHERE shop_id=$1 AND customer_id=$2
           AND id<>$3 AND accepted_at IS NULL AND revoked_at IS NULL`,
        [candidate.shop_id, candidate.customer_id, invitation.id],
      );
      const [shop] = await tx.query('SELECT name FROM shops WHERE id=$1', [
        candidate.shop_id,
      ]);
      return { shopId: candidate.shop_id, shopName: shop.name };
    });
  }

  async acceptAndLogin(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new BadRequestException('Недействительный код приглашения');
    const hash = digest(token);
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx.query(
        `SELECT shop_id,customer_id FROM shop_customer_invitations
         WHERE token_hash=$1`,
        [hash],
      );
      if (!candidate)
        throw new BadRequestException('Недействительный код приглашения');

      const [customer] = await tx.query(
        `SELECT phone_e164,display_name,buyer_account_id
         FROM shop_customers WHERE shop_id=$1 AND id=$2 FOR UPDATE`,
        [candidate.shop_id, candidate.customer_id],
      );
      if (!customer) throw new NotFoundException('Клиент не найден');

      const [invitation] = await tx.query(
        `SELECT id,expires_at,accepted_at,revoked_at
         FROM shop_customer_invitations
         WHERE token_hash=$1 FOR UPDATE`,
        [hash],
      );
      if (
        !invitation ||
        invitation.revoked_at ||
        invitation.accepted_at ||
        new Date(invitation.expires_at).getTime() <= Date.now()
      ) {
        throw new ConflictException('Код уже использован или истёк');
      }
      if (customer.buyer_account_id) {
        throw new ConflictException('Клиент уже привязан к кабинету');
      }

      const [existingBuyer] = await tx.query(
        'SELECT id FROM buyer_accounts WHERE phone_e164=$1 FOR UPDATE',
        [customer.phone_e164],
      );

      let buyerId: string;
      let isNewAccount = false;
      if (existingBuyer) {
        buyerId = existingBuyer.id;
      } else {
        const generated = generateBuyerPassword(12);
        const pwHash = await hashPassword(generated);
        const encrypted = this.buyerAuth.encryptInitialPassword(generated);
        const [created] = await tx.query(
          `INSERT INTO buyer_accounts
           (phone_e164,display_name,password_hash,initial_password_enc)
           VALUES($1,$2,$3,$4)
           RETURNING id`,
          [customer.phone_e164, customer.display_name, pwHash, encrypted],
        );
        buyerId = created.id;
        isNewAccount = true;
      }

      await tx.query(
        `UPDATE shop_customers
         SET buyer_account_id=$3,updated_at=now()
         WHERE shop_id=$1 AND id=$2 AND buyer_account_id IS NULL`,
        [candidate.shop_id, candidate.customer_id, buyerId],
      );
      await tx.query(
        `UPDATE shop_customer_invitations
         SET accepted_at=now(),accepted_by=$2
         WHERE id=$1`,
        [invitation.id, buyerId],
      );
      await tx.query(
        `UPDATE shop_customer_invitations SET revoked_at=now()
         WHERE shop_id=$1 AND customer_id=$2
           AND id<>$3 AND accepted_at IS NULL AND revoked_at IS NULL`,
        [candidate.shop_id, candidate.customer_id, invitation.id],
      );
      const [shop] = await tx.query('SELECT name FROM shops WHERE id=$1', [
        candidate.shop_id,
      ]);
      const session = await this.buyerAuth.createSession(buyerId, tx);
      return {
        token: session.token,
        expiresIn: session.expiresIn,
        shopId: candidate.shop_id,
        shopName: shop.name,
        isNewAccount,
      };
    });
  }
}
