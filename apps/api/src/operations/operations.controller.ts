import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { NotificationsService } from './notifications.service';

@Controller('shops/:shopId')
@UseGuards(AuthGuard)
export class OperationsController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly operations: NotificationsService,
  ) {}

  @Get('notifications')
  async notifications(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Query('limit') rawLimit?: string,
  ) {
    await this.access.requireMembership(req.userId, shop, 'read');
    return this.operations.list(shop, Number(rawLimit) || 50);
  }

  @Post('notifications/:id/read')
  async read(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shop, 'read');
    return this.operations.read(shop, id);
  }

  @Get('audit')
  async audit(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Query('limit') rawLimit?: string,
  ) {
    await this.access.requireMembership(req.userId, shop, 'reports');
    return this.operations.audit(shop, Number(rawLimit) || 100);
  }
}
