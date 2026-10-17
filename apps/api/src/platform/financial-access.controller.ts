import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  IsEmail,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Response } from 'express';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { FinancialAccessService } from './financial-access.service';
class GrantDto {
  @IsEmail() @MaxLength(254) adminEmail!: string;
  @IsString() @MinLength(1) @MaxLength(500) purpose!: string;
  @IsInt() @Min(1) @Max(168) durationHours!: number;
}
@Controller('shops/:shopId/platform-access')
@UseGuards(AuthGuard)
export class OwnerFinancialAccessController {
  constructor(private readonly access: FinancialAccessService) {}
  @Get() list(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
  ) {
    return this.access.list(shop, req.userId);
  }
  @Post() grant(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Body() body: GrantDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.access.grant(shop, req.userId, body, key);
  }
  @Post(':id/revoke') revoke(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return this.access.revoke(shop, req.userId, id, key);
  }
}
@Controller('platform/admin/financial-access')
@UseGuards(AuthGuard)
export class AdminFinancialAccessController {
  constructor(private readonly access: FinancialAccessService) {}
  @Get() list(@Req() req: UserRequest) {
    return this.access.mine(req.userId);
  }
  @Get(':id/summary') summary(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.access.summary(req.userId, id);
  }
}
