import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
export type ShopPermission = 'read' | 'receive' | 'sell' | 'catalog';
export type Membership = { role: 'owner' | 'manager' | 'cashier' };
@Injectable()
export class ShopAccessService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}
  async requireMembership(
    userId: string,
    shopId: string,
    permission: ShopPermission,
  ): Promise<Membership> {
    const [member] = await this.db.query(
      'SELECT role FROM memberships WHERE shop_id=$1 AND user_id=$2',
      [shopId, userId],
    );
    if (
      !member ||
      (member.role === 'cashier' &&
        permission !== 'read' &&
        permission !== 'sell')
    )
      throw new ForbiddenException();
    return member;
  }
}
