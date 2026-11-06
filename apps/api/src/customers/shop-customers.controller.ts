import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
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
import { ShopCustomersService } from './shop-customers.service';

class NewShopCustomerDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MaxLength(32) phone!: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
}
class CustomerQuery {
  @IsOptional() @IsString() @MaxLength(120) q = '';
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 10;
}
@Controller('shops/:shopId/customers')
@UseGuards(AuthGuard)
export class ShopCustomersController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly customers: ShopCustomersService,
  ) {}
  @Get()
  async list(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Query() query: CustomerQuery,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'read');
    return this.customers.list(shopId, query.q, query.page, query.pageSize);
  }
  @Post()
  async create(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Body() dto: NewShopCustomerDto,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    return this.customers.create(
      shopId,
      req.userId,
      dto.phone,
      dto.name,
      dto.address,
    );
  }
  @Get(':id')
  async get(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'read');
    return this.customers.get(shopId, id);
  }
}
