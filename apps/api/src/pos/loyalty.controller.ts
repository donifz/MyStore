import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { BuyerAuthGuard, BuyerRequest } from '../customers/buyer-auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { LoyaltyService, loyaltyEnabled } from './loyalty.service';

class LookupQrDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}

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

  @Get('purchases')
  purchases(@Req() req: BuyerRequest) {
    return this.loyalty.purchases(req.buyerId);
  }

  @Post('qr')
  qr(@Req() req: BuyerRequest) {
    return this.loyalty.issueQr(req.buyerId);
  }
}

@Controller('shops/:shopId/pos/loyalty')
@UseGuards(AuthGuard)
export class PosLoyaltyController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly loyalty: LoyaltyService,
  ) {}

  @Post('lookup')
  async lookup(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Body() dto: LookupQrDto,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    return this.loyalty.lookupByQr(shopId, dto.token);
  }
}
