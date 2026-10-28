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
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { PlatformAdminService } from './platform-admin.service';

class MarketplaceStatusDto {
  @IsBoolean()
  blocked!: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

class SubscriptionDto {
  @IsOptional()
  @IsString()
  until?: string | null;
}

class OwnerPasswordDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  ownerEmail?: string;
}

@Controller('platform/admin')
@UseGuards(AuthGuard)
export class AdminSessionController {
  constructor(private readonly admins: PlatformAdminService) {}

  @Get('overview') async overview(@Req() req: UserRequest) {
    await this.admins.requireAdmin(req.userId);
    return this.admins.overview();
  }

  @Get('session') async session(@Req() req: UserRequest) {
    await this.admins.requireAdmin(req.userId);
    return { platformAdmin: true };
  }

  @Post('shops/:shopId/marketplace-status')
  async setMarketplaceStatus(
    @Req() req: UserRequest,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Body() body: MarketplaceStatusDto,
  ) {
    await this.admins.requireAdmin(req.userId);
    return this.admins.setMarketplaceBlocked(
      req.userId,
      shopId,
      body.blocked,
      body.reason,
    );
  }

  @Post('shops/:shopId/subscription')
  async setSubscription(
    @Req() req: UserRequest,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Body() body: SubscriptionDto,
  ) {
    await this.admins.requireAdmin(req.userId);
    return this.admins.setSubscription(req.userId, shopId, body.until ?? null);
  }

  @Post('shops/:shopId/reset-owner-password')
  async resetOwnerPassword(
    @Req() req: UserRequest,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Body() body: OwnerPasswordDto,
  ) {
    await this.admins.requireAdmin(req.userId);
    return this.admins.resetOwnerPassword(req.userId, shopId, body?.ownerEmail);
  }
}
