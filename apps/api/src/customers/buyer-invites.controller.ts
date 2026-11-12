import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { csrfFor, validateOrigin } from '../auth/browser-security';
import { ShopAccessService } from '../shops/shop-access.service';
import { setBuyerSessionCookie } from './buyer-auth.controller';
import { BuyerAuthGuard, BuyerRequest } from './buyer-auth.guard';
import { BuyerAuthService } from './buyer-auth.service';
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

  @Post(':customerId/invite/reset')
  async reset(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    return this.invites.resetAccess(shopId, customerId, req.userId);
  }
}

@Controller('buyer')
export class BuyerInvitesController {
  constructor(
    private readonly invites: BuyerInvitesService,
    private readonly buyers: BuyerAuthService,
  ) {}

  @Post('link-shop')
  @UseGuards(BuyerAuthGuard)
  async link(@Req() req: BuyerRequest, @Body() body: AcceptInviteDto) {
    return this.invites.accept(req.buyerId, body.token);
  }

  @Post('accept-invite')
  async acceptInvite(
    @Body() body: AcceptInviteDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    validateOrigin(req.headers.origin);
    this.buyers.limit('accept-invite:' + (req.ip ?? 'unknown'));
    const result = await this.invites.acceptAndLogin(body.token);
    setBuyerSessionCookie(res, result.token);
    return {
      expiresIn: result.expiresIn,
      csrfToken: csrfFor(result.token),
      shopId: result.shopId,
      shopName: result.shopName,
      isNewAccount: result.isNewAccount,
    };
  }
}
