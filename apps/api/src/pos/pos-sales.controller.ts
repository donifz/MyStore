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
  IsIn,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { SaleLineDto } from './sales.controller';
import { PosSalesService } from './pos-sales.service';
import { SalesHistoryService } from './sales-history.service';
import { PaymentMethod } from './pos.types';
class PosSaleDto {
  @IsUUID() shiftId!: string;
  @IsIn(['cash', 'card']) method!: PaymentMethod;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines!: SaleLineDto[];
}
class PageQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}
@Controller('shops/:shopId/pos/sales')
@UseGuards(AuthGuard)
export class PosSalesController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly sales: PosSalesService,
    private readonly history: SalesHistoryService,
  ) {}
  @Post() async sell(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() dto: PosSaleDto,
  ) {
    await this.access.requireMembership(req.userId, shop, 'sell');
    return this.sales.sell(
      shop,
      req.userId,
      key,
      dto.shiftId,
      dto.method,
      dto.lines,
    );
  }
  @Get() async list(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Query() q: PageQuery,
  ) {
    const m = await this.access.requireMembership(req.userId, shop, 'read');
    return this.history.list(
      shop,
      req.userId,
      m.canReturn || m.canViewReports,
      q.page,
      q.pageSize,
    );
  }
  @Get(':id') async get(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    const m = await this.access.requireMembership(req.userId, shop, 'read');
    return this.history.detail(
      shop,
      id,
      req.userId,
      m.canReturn || m.canViewReports,
    );
  }
}
