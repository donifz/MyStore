import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { BuyerAuthGuard, BuyerRequest } from '../customers/buyer-auth.guard';
import { LoyaltyService, loyaltyEnabled } from './loyalty.service';

@Controller('buyer/loyalty')
@UseGuards(BuyerAuthGuard)
export class BuyerLoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('config')
  config() {
    return { enabled: loyaltyEnabled() };
  }

  @Get('wallets')
  wallets(@Req() req: BuyerRequest) {
    return this.loyalty.wallets(req.buyerId);
  }

  @Post('qr')
  qr(@Req() req: BuyerRequest) {
    return this.loyalty.issueQr(req.buyerId);
  }
}
