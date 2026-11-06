import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { BuyerAuthGuard, BuyerRequest } from '../customers/buyer-auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { SaleLineDto } from './sales.controller';
import { CreditSalesService } from './credit-sales.service';

class CreditSaleDto {
  @IsUUID() shiftId!: string;
  @IsUUID() customerId!: string;
  @IsIn(['cash', 'card']) method!: 'cash' | 'card';
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) paidMinor!: number;
  @IsDateString() dueOn!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines!: SaleLineDto[];
}

class CreditRepaymentDto {
  @IsUUID() shiftId!: string;
  @IsIn(['cash', 'card']) method!: 'cash' | 'card';
  @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) amountMinor!: number;
}

@Controller('shops/:shopId/pos/credit-sales')
@UseGuards(AuthGuard)
export class CreditSalesController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly credits: CreditSalesService,
  ) {}

  @Post()
  async sell(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() dto: CreditSaleDto,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    return this.credits.sell({
      shopId,
      actorId: req.userId,
      key,
      ...dto,
      method: dto.method,
      lines: dto.lines,
    });
  }

  @Post(':saleId/repayments')
  async repay(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() dto: CreditRepaymentDto,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    return this.credits.repay({
      shopId, saleId, actorId: req.userId, key,
      shiftId: dto.shiftId, method: dto.method, amountMinor: dto.amountMinor,
    });
  }

  @Get(':saleId/repayments')
  async repayments(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'read');
    return this.credits.repayments(shopId, saleId);
  }

  @Get()
  async list(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Query('customerId', ParseUUIDPipe) customerId: string,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'read');
    return this.credits.list(shopId, customerId);
  }
}

@Controller('buyer')
@UseGuards(BuyerAuthGuard)
export class BuyerDebtsController {
  constructor(private readonly credits: CreditSalesService) {}

  @Get('debts')
  async debts(@Req() req: BuyerRequest) {
    return this.credits.buyerDebts(req.buyerId);
  }

  @Get('repayments')
  async repayments(@Req() req: BuyerRequest) {
    return this.credits.buyerRepayments(req.buyerId);
  }
}
