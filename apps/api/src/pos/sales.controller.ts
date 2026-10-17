import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { SalesService } from './sales.service';
export class SaleLineDto {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) @Max(1000000000) quantity!: number;
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedUnitPriceMinor!: number;
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  discountMinor?: number;
  @IsOptional()
  @IsString()
  @MaxLength(250)
  discountReason?: string;
}
class SaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines!: SaleLineDto[];
}
@Controller('shops/:shopId/sales')
@UseGuards(AuthGuard)
export class SalesController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly sales: SalesService,
  ) {}
  @Post() async sell(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() body: SaleDto,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    return this.sales.sell(shopId, req.userId, key, body.lines);
  }
}
