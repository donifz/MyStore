import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DATABASE } from '../database';
type WritePermission = 'receive' | 'sell' | 'catalog' | 'reports' | 'return';
export type ShopPermission = 'read' | WritePermission;
export type Membership = {
  role: 'owner' | 'manager' | 'cashier';
  canReturn: boolean;
  canViewReports: boolean;
};
@Injectable()
export class ShopAccessService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}
  async requireMembership(
    userId: string,
    shopId: string,
    permission: ShopPermission,
    tx?: EntityManager,
  ): Promise<Membership> {
    // Staff mutations take the shop lock first. Hold it through a return so
    // revocation and posting have one order, before shift and stock locks.
    if (tx)
      await tx.query('SELECT id FROM shops WHERE id=$1 FOR SHARE', [shopId]);
    const [member] = await (tx ?? this.db).query(
      `SELECT role,(role='owner' OR can_return) AS "canReturn",
       (role='owner' OR can_view_reports) AS "canViewReports"
       FROM memberships WHERE shop_id=$1 AND user_id=$2`,
      [shopId, userId],
    );
    if (!member) throw new ForbiddenException();
    if (permission === 'return') {
      if (!member.canReturn) throw new ForbiddenException();
    } else if (permission === 'reports') {
      if (!member.canViewReports) throw new ForbiddenException();
    } else if (
      member.role === 'cashier' &&
      permission !== 'read' &&
      permission !== 'sell'
    ) {
      throw new ForbiddenException();
    }
    return member;
  }
}
