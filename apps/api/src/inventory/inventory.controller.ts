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
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { ReceivingService } from './receiving.service';
import { StockService } from './stock.service';
export class ReceiveLineDto {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) @Max(1000000000) quantity!: number;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) unitCostMinor!: number;
}
class ReceiveDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines!: ReceiveLineDto[];
}
@Controller('shops/:shopId')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly receiving: ReceivingService,
    private readonly stock: StockService,
  ) {}
  @Post('receivings') async receive(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() body: ReceiveDto,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'receive');
    return this.receiving.receive(shopId, req.userId, key, body.lines);
  }
  @Get('stock/:variantId') async balance(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('variantId', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    const member = await this.access.requireMembership(
      req.userId,
      shopId,
      'read',
    );
    const result = await this.stock.getBalance(shopId, id);
    if (member.role === 'cashier') {
      const { stockValueMinor, ...visible } = result;
      return visible;
    }
    return result;
  }
}
