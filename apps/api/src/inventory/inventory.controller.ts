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
  IsString,
  MaxLength,
  IsDateString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { ReceivingService } from './receiving.service';
import { StockService } from './stock.service';
import { StockOperationsService } from './stock-operations.service';
export class ReceiveLineDto {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) @Max(1000000000) quantity!: number;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) unitCostMinor!: number;
}
class ReceiveDto {
  @IsOptional() @IsString() @MaxLength(120) documentNumber?: string;
  @IsOptional() @IsString() @MaxLength(200) supplier?: string;
  @IsOptional() @IsDateString() receivedOn?: string;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines!: ReceiveLineDto[];
}
class CountDto {
  @IsUUID() variantId!: string;
  @IsInt() @Min(0) @Max(1000000000) expectedQuantity!: number;
  @IsInt() @Min(0) @Max(1000000000) countedQuantity!: number;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) unitCostMinor!: number;
  @IsString() @MaxLength(500) reason!: string;
}
class RemoveDto {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) @Max(1000000000) quantity!: number;
  @IsString() @MaxLength(500) reason!: string;
}
@Controller('shops/:shopId')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly receiving: ReceivingService,
    private readonly stock: StockService,
    private readonly operations: StockOperationsService,
  ) {}
  @Post('receivings') async receive(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() body: ReceiveDto,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'receive');
    return this.receiving.receive(shopId, req.userId, key, body);
  }
  @Get('receivings') async receivings(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'receive');
    return this.receiving.list(shopId);
  }
  @Get('receivings/:id') async receivingDetail(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'receive');
    return this.receiving.detail(shopId, id);
  }
  @Post('inventory/counts') async count(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() body: CountDto,
  ) {
    await this.access.requireMembership(req.userId, shop, 'receive');
    return this.operations.count(shop, req.userId, key, body);
  }
  @Post('inventory/writeoffs') async writeoff(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() body: RemoveDto,
  ) {
    await this.access.requireMembership(req.userId, shop, 'receive');
    return this.operations.writeoff(shop, req.userId, key, body);
  }
  @Get('inventory/defects/:variantId') async defects(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('variantId', ParseUUIDPipe) variant: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shop, 'receive');
    return this.operations.defects(shop, variant);
  }
  @Post('inventory/defects/disposals') async dispose(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() body: RemoveDto,
  ) {
    await this.access.requireMembership(req.userId, shop, 'receive');
    return this.operations.dispose(shop, req.userId, key, body);
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
    if (member.role === 'cashier' && !member.canViewReports) {
      const { stockValueMinor, ...visible } = result;
      return visible;
    }
    return result;
  }
}
