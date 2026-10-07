import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';
type WritePermission = 'receive' | 'sell' | 'catalog' | 'reports';
export type ShopPermission = 'read' | WritePermission;
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
    const cashierDenied =
      member?.role === 'cashier' &&
      permission !== 'read' &&
      permission !== 'sell';
    const reportsDenied = permission === 'reports' && member?.role !== 'owner';
    if (!member || cashierDenied || reportsDenied)
      throw new ForbiddenException();
    return member;
  }
}
