import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { BuyerAuthGuard, BuyerRequest } from './buyer-auth.guard';
import { BuyerInvitesService } from './buyer-invites.service';

class AcceptInviteDto {
  @IsString() @MinLength(43) @MaxLength(43) token!: string;
}

@Controller('shops/:shopId/customers')
@UseGuards(AuthGuard)
export class ShopBuyerInvitesController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly invites: BuyerInvitesService,
  ) {}

  @Post(':customerId/invite')
  async issue(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    return this.invites.issue(shopId, customerId, req.userId);
  }
}

@Controller('buyer')
@UseGuards(BuyerAuthGuard)
export class BuyerInvitesController {
  constructor(private readonly invites: BuyerInvitesService) {}

  @Post('link-shop')
  async link(@Req() req: BuyerRequest, @Body() body: AcceptInviteDto) {
    return this.invites.accept(req.buyerId, body.token);
  }
}
