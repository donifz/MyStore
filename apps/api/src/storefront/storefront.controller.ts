import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Response } from 'express';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { CaptureService } from '../catalog/capture.service';
import { StorefrontService } from './storefront.service';
class PageQuery {
  @IsOptional() @IsString() @MaxLength(128) q = '';
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 24;
}
class StoreQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(80) city = '';
  @IsOptional() @IsString() @MaxLength(80) district = '';
  @IsOptional() @IsString() @MaxLength(80) category = '';
}
class ProductQuery extends StoreQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000000000)
  minPrice?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000000000)
  maxPrice?: number;
  @IsOptional() @IsString() @MaxLength(80) store = '';
  @IsIn(['true', 'false']) inStock = 'false';
  @IsIn(['name', 'price-asc', 'price-desc']) sort = 'name';
}
class ProfileDto {
  @IsOptional() @IsString() @MaxLength(80) district?: string;
  @IsOptional() @IsBoolean() pickupEnabled?: boolean;
  @IsOptional() @IsBoolean() deliveryEnabled?: boolean;
  @IsString() @MaxLength(2000) description!: string;
  @IsString() @MaxLength(80) city!: string;
  @IsString() @MaxLength(250) address!: string;
  @IsString() @MaxLength(30) phone!: string;
  @IsString() @MaxLength(120) hours!: string;
  @IsBoolean() published!: boolean;
}
@Controller('public')
export class PublicStorefrontController {
  constructor(
    private readonly service: StorefrontService,
    private readonly capture: CaptureService,
  ) {}
  @Get('stores/:slug/products/:id/photo') async photo(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.type('image/jpeg').send(await this.capture.photo(null, id, slug));
  }
  @Get('filters') filters() {
    return this.service.filters();
  }
  @Get('stores') stores(
    @Query() q: StoreQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.stores(q.q, q.page, q.pageSize, q);
  }
  @Get('stores/:slug') store(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.store(slug);
  }
  @Get('products') products(
    @Query() q: ProductQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.products(q);
  }
  @Get('stores/:slug/products/:id') product(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.product(slug, id);
  }
}
@Controller('shops/:shopId/storefront')
@UseGuards(AuthGuard)
export class StorefrontSettingsController {
  constructor(private readonly service: StorefrontService) {}
  @Get() async get(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
  ) {
    await this.service.owner(req.userId, shop);
    return this.service.profile(shop);
  }
  @Put() async update(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Body() body: ProfileDto,
  ) {
    await this.service.owner(req.userId, shop);
    return this.service.updateProfile(shop, body);
  }
}
