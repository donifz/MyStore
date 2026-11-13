import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  Allow,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Request, Response } from 'express';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { CaptureService } from '../catalog/capture.service';
import { ShopCustomAttributesService } from '../catalog/shop-custom-attributes.service';
import { StorefrontService } from './storefront.service';
import { BuyerAuthGuard, BuyerRequest } from '../customers/buyer-auth.guard';
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
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;
  @IsOptional() @IsString() @MaxLength(80) store = '';
  @IsIn(['true', 'false']) inStock = 'false';
  @IsIn(['name', 'price-asc', 'price-desc', 'newest']) sort = 'newest';
}
class CreateReviewDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{8,64}$/)
  operationKey!: string;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment = '';
}
class ProfileDto {
  @IsOptional() @IsString() @MaxLength(40) slug?: string;
  @Allow() banner?: unknown;
  @Allow() timeZone?: string;
  @Allow() businessSchedule?: unknown;
  @IsOptional() @IsString() @MaxLength(80) district?: string;
  @IsOptional() @IsBoolean() pickupEnabled?: boolean;
  @IsOptional() @IsBoolean() deliveryEnabled?: boolean;
  @IsString() @MaxLength(2000) description!: string;
  @IsString() @MaxLength(80) city!: string;
  @IsString() @MaxLength(250) address!: string;
  @IsString() @MaxLength(30) phone!: string;
  @IsString() @MaxLength(1000) hours!: string;
  @IsBoolean() published!: boolean;
}
class BannerDto {
  @Allow() banner?: unknown;
}
@Controller('public')
export class PublicStorefrontController {
  constructor(
    private readonly service: StorefrontService,
    private readonly capture: CaptureService,
    private readonly customAttributes: ShopCustomAttributesService,
  ) {}
  @Get('stores/:slug/products/:id/photo') async photo(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('index') index: string | undefined,
    @Res() res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    const photoIndex = index === undefined ? 0 : Number(index);
    res
      .type('image/jpeg')
      .send(await this.capture.photo(null, id, slug, photoIndex));
  }
  @Get('hero-slides') heroSlides() {
    return this.service.heroSlides();
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
  @Get('stores/:slug') async store(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.store(slug);
  }
  @Get('stores/:slug/custom-attributes') async storeCustomAttributes(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.customAttributes.listStorefront(slug);
  }
  @Get('products') products(
    @Query() q: ProductQuery,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    const attributes: Record<string, string | string[]> = {};
    const rawQuery = (req.query || {}) as Record<string, any>;
    for (const [k, v] of Object.entries(rawQuery)) {
      if (k.startsWith('attr_')) {
        const attrKey = k.slice(5);
        if (attrKey) attributes[attrKey] = v;
      }
    }
    if (rawQuery.attrs) {
      try {
        const parsed =
          typeof rawQuery.attrs === 'string'
            ? JSON.parse(rawQuery.attrs)
            : rawQuery.attrs;
        if (typeof parsed === 'object' && parsed !== null) {
          Object.assign(attributes, parsed);
        }
      } catch {}
    }
    return this.service.products({
      ...q,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    });
  }
  @Get('stores/:slug/products/:id') product(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.product(slug, id);
  }
  @Get('stores/:slug/reviews') storeReviews(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.storeReviews(slug);
  }
  @Post('stores/:slug/reviews')
  @UseGuards(BuyerAuthGuard)
  createStoreReview(
    @Param('slug') slug: string,
    @Body() body: CreateReviewDto,
    @Req() req: BuyerRequest,
  ) {
    return this.service.createStoreReview(slug, req.buyerId, body);
  }
  @Get('stores/:slug/products/:id/reviews') productReviews(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.productReviews(slug, id);
  }
  @Post('stores/:slug/products/:id/reviews')
  @UseGuards(BuyerAuthGuard)
  createProductReview(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateReviewDto,
    @Req() req: BuyerRequest,
  ) {
    return this.service.createProductReview(slug, id, req.buyerId, body);
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
  @Put('banner') async updateBanner(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Body() body: BannerDto,
  ) {
    await this.service.owner(req.userId, shop);
    return this.service.updateBanner(shop, body.banner, req.userId);
  }
  @Put() async update(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Body() body: ProfileDto,
  ) {
    await this.service.owner(req.userId, shop);
    return this.service.updateProfile(shop, body, req.userId);
  }
}
