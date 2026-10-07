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
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Request, Response } from 'express';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { validateOrigin } from '../auth/browser-security';
import { CaptureService } from '../catalog/capture.service';
import { StorefrontService } from './storefront.service';
class PageQuery {
  @IsOptional() @IsString() @MaxLength(128) q = '';
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 24;
}
class ProductQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(80) store = '';
  @IsOptional() @IsString() @MaxLength(80) category = '';
  @IsIn(['true', 'false']) inStock = 'false';
  @IsIn(['name', 'price-asc', 'price-desc']) sort = 'name';
}
class ProfileDto {
  @IsString() @MaxLength(2000) description!: string;
  @IsString() @MaxLength(80) city!: string;
  @IsString() @MaxLength(250) address!: string;
  @IsString() @MaxLength(30) phone!: string;
  @IsString() @MaxLength(120) hours!: string;
  @IsBoolean() published!: boolean;
}
class RegisterDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(12) @MaxLength(256) password!: string;
  @IsString() @MinLength(1) @MaxLength(200) @Matches(/\S/) shopName!: string;
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
  @Get('stores') stores(
    @Query() q: PageQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.stores(q.q, q.page, q.pageSize);
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
@Controller('partners')
export class PartnersController {
  constructor(
    private readonly service: StorefrontService,
    private readonly auth: AuthService,
  ) {}
  @Post('register') register(@Body() body: RegisterDto, @Req() req: Request) {
    validateOrigin(req.headers.origin);
    this.auth.limitLogin('registration:' + (req.ip ?? 'unknown'));
    return this.service.register(body);
  }
}
