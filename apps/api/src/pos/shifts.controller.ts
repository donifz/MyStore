import {
  Body,
  ForbiddenException,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { ShiftsService } from './shifts.service';
class OpenDto {
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) openingCashMinor!: number;
}
class CloseDto {
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) actualCashMinor!: number;
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}
class CashTransactionDto {
  @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) amountMinor!: number;
  @IsString() @MinLength(1) @MaxLength(250) reason!: string;
}
@Controller('shops/:shopId/pos/shifts')
@UseGuards(AuthGuard)
export class ShiftsController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly shifts: ShiftsService,
  ) {}
  @Post() async open(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() dto: OpenDto,
  ) {
    await this.access.requireMembership(req.userId, shop, 'sell');
    return this.shifts.open(shop, req.userId, key, dto.openingCashMinor);
  }
  @Get('active') async active(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
  ) {
    const m = await this.access.requireMembership(req.userId, shop, 'read');
    if (m.role !== 'owner') throw new ForbiddenException();
    return this.shifts.active(shop);
  }
  @Get('current') async current(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shop, 'sell');
    return this.shifts.current(shop, req.userId);
  }
  @Get(':id') async get(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    const m = await this.access.requireMembership(req.userId, shop, 'read');
    return this.shifts.get(shop, id, req.userId, m.role === 'owner');
  }
  @Post(':id/close') async close(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() dto: CloseDto,
  ) {
    const m = await this.access.requireMembership(req.userId, shop, 'sell');
    return this.shifts.close(
      shop,
      id,
      req.userId,
      m.role === 'owner',
      key,
      dto.actualCashMinor,
      dto.comment,
    );
  }
  @Post(':id/cash-in') async cashIn(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() dto: CashTransactionDto,
  ) {
    await this.access.requireMembership(req.userId, shop, 'sell');
    return this.shifts.cashIn(
      shop,
      id,
      req.userId,
      key,
      dto.amountMinor,
      dto.reason,
    );
  }
  @Post(':id/cash-out') async cashOut(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() dto: CashTransactionDto,
  ) {
    await this.access.requireMembership(req.userId, shop, 'sell');
    return this.shifts.cashOut(
      shop,
      id,
      req.userId,
      key,
      dto.amountMinor,
      dto.reason,
    );
  }
  @Get(':id/transactions') async transactions(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    const m = await this.access.requireMembership(req.userId, shop, 'read');
    return this.shifts.listTransactions(
      shop,
      id,
      req.userId,
      m.role === 'owner' || m.role === 'manager',
    );
  }
}
