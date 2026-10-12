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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  ValidateIf,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Request, Response } from 'express';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { validateOrigin } from '../auth/browser-security';
import { ShopAccessService } from '../shops/shop-access.service';
import { PaymentMethod } from '../pos/pos.types';
import { OrdersService, CheckoutInput } from './orders.service';
class ReceiptDto {
  @IsUUID('4') checkoutKey!: string;
}
class OrderLineDto {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) @Max(1000000) quantity!: number;
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedUnitPriceMinor!: number;
}
class CheckoutDto extends ReceiptDto implements CheckoutInput {
  @IsString() @MinLength(1) @MaxLength(80) storeSlug!: string;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsString() @MaxLength(30) phone!: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsEmail()
  @MaxLength(254)
  email?: string;
  @IsIn(['pickup', 'delivery']) fulfillment!: 'pickup' | 'delivery';
  @IsString() @MaxLength(250) address!: string;
  @IsString() @MaxLength(500) comment!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines!: OrderLineDto[];
}
class PageQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}
class StatusDto {
  @IsIn(['confirmed', 'ready', 'cancelled']) status!:
    'confirmed' | 'ready' | 'cancelled';
}
class IssueDto {
  @IsUUID() shiftId!: string;
  @IsIn(['cash', 'card']) method!: PaymentMethod;
}
@Controller('public/orders')
export class PublicOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly auth: AuthService,
  ) {}
  @Post() create(
    @Body() body: CheckoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    validateOrigin(req.headers.origin);
    this.auth.limitLogin('order-create:' + (req.ip ?? 'unknown'));
    res.setHeader('Cache-Control', 'no-store');
    return this.orders.create(body);
  }
  @Post('receipt') receipt(
    @Body() body: ReceiptDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    validateOrigin(req.headers.origin);
    this.auth.limitLogin('order-receipt:' + (req.ip ?? 'unknown'));
    res.setHeader('Cache-Control', 'no-store');
    return this.orders.receipt(body.checkoutKey);
  }
}
@Controller('shops/:shopId/orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly access: ShopAccessService,
  ) {}
  @Get() async list(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Query() q: PageQuery,
  ) {
    await this.access.requireMembership(req.userId, shop, 'read');
    return this.orders.list(shop, q.page, q.pageSize);
  }
  @Get(':id') async detail(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shop, 'read');
    return this.orders.detail(shop, id);
  }
  @Post(':id/status') async status(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
    @Body() b: StatusDto,
  ) {
    await this.access.requireMembership(req.userId, shop, 'catalog');
    return this.orders.status(shop, id, req.userId, b.status);
  }
  @Post(':id/issue') async issue(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() b: IssueDto,
  ) {
    await this.access.requireMembership(req.userId, shop, 'sell');
    return this.orders.issue(shop, id, req.userId, key, b.shiftId, b.method);
  }
}
