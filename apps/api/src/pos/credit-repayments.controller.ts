import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsInt, IsUUID, Max, Min } from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { BuyerAuthGuard, BuyerRequest } from '../customers/buyer-auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { CreditRepaymentsService } from './credit-repayments.service';

class RepaymentDto {
  @IsUUID() shiftId!: string;
  @IsIn(['cash', 'card']) method!: 'cash' | 'card';
  @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) amountMinor!: number;
}

@Controller('shops/:shopId/pos/credit-sales/:saleId/repayments')
@UseGuards(AuthGuard)
export class CreditRepaymentsController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly repayments: CreditRepaymentsService,
  ) {}

  @Post()
  async repay(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() dto: RepaymentDto,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    return this.repayments.repay({
      shopId,
      saleId,
      actorId: req.userId,
      key,
      ...dto,
    });
  }

  @Get()
  async history(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'read');
    return this.repayments.saleHistory(shopId, saleId);
  }
}

@Controller('buyer')
@UseGuards(BuyerAuthGuard)
export class BuyerRepaymentsController {
  constructor(private readonly repayments: CreditRepaymentsService) {}

  @Get('repayments')
  async history(@Req() req: BuyerRequest) {
    return this.repayments.buyerHistory(req.buyerId);
  }
}
