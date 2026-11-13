import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from './shop-access.service';
import { ShopTelegramService } from './shop-telegram.service';

@Controller('shops/:shopId/telegram')
@UseGuards(AuthGuard)
export class ShopTelegramController {
  constructor(
    private readonly telegram: ShopTelegramService,
    private readonly access: ShopAccessService,
  ) {}

  private async checkOwner(userId: string, shopId: string) {
    const member = await this.access.requireMembership(userId, shopId, 'read');
    if (member.role !== 'owner') {
      throw new ForbiddenException(
        'Только владелец магазина может управлять Telegram-уведомлениями',
      );
    }
  }

  @Get('status')
  async getStatus(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
  ) {
    await this.checkOwner(req.userId, shopId);
    return this.telegram.getStatus(shopId);
  }

  @Post('link-token')
  async createLinkToken(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
  ) {
    await this.checkOwner(req.userId, shopId);
    return this.telegram.createLinkToken(shopId, req.userId);
  }

  @Post('manual-subscribe')
  async manualSubscribe(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Body() body: { chatId: string | number },
  ) {
    await this.checkOwner(req.userId, shopId);
    return this.telegram.manualSubscribe(shopId, body.chatId);
  }

  @Post('test-summary')
  async sendTestSummary(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
  ) {
    await this.checkOwner(req.userId, shopId);
    return this.telegram.sendTestSummary(shopId);
  }

  @Delete('subscription')
  async unsubscribe(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
  ) {
    await this.checkOwner(req.userId, shopId);
    return this.telegram.unsubscribe(shopId);
  }
}
