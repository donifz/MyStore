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
  ServiceUnavailableException,
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
import { creditSalesEnabled } from './credit-feature';

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
    if (!creditSalesEnabled()) throw new ServiceUnavailableException('Продажа в долг пока недоступна');
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
}
