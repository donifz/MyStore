import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  Max,
  Min,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { PlatformAdminService } from './platform-admin.service';
import { UpdateHeroSlidesDto } from './hero-slides.dto';

class ShopsPageQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 10;
  @IsOptional() @IsString() @MaxLength(128) q = '';
  @IsOptional() @IsIn(['name', 'city']) sort: 'name' | 'city' = 'name';
}

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

  @Get('shops') async shops(
    @Req() req: UserRequest,
    @Query() query: ShopsPageQuery,
  ) {
    await this.admins.requireAdmin(req.userId);
    return this.admins.listShops(
      query.page,
      query.pageSize,
      query.q,
      query.sort,
    );
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

  @Get('hero-slides')
  async heroSlides(@Req() req: UserRequest) {
    await this.admins.requireAdmin(req.userId);
    return this.admins.listHeroSlides();
  }

  @Put('hero-slides')
  async updateHeroSlides(
    @Req() req: UserRequest,
    @Body() body: UpdateHeroSlidesDto,
  ) {
    await this.admins.requireAdmin(req.userId);
    return this.admins.updateHeroSlides(req.userId, body.slides || []);
  }
}
