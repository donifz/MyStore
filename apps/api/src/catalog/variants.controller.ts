import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  ArrayMaxSize,
  Min,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { VariantsService } from './variants.service';
export class VariantFieldsDto {
  @IsString() @MinLength(1) @MaxLength(200) @Matches(/\S/) name!: string;
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[\x21-\x7E]+$/)
  barcode?: string;
  @IsOptional() @IsString() @MaxLength(80) size?: string;
  @IsOptional() @IsString() @MaxLength(80) color?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) salePriceMinor!: number;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MaxLength(80) subcategory?: string;
}
export class VariantDto extends VariantFieldsDto {
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(699074) photoDataUrl?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  photoDataUrls?: string[];
}
class ReplaceAlbumDto {
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  photoDataUrls!: string[];
}
class EditVariantDto {
  @IsString() @MinLength(1) @MaxLength(200) @Matches(/\S/) name!: string;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) salePriceMinor!: number;
  @IsString() @MaxLength(2000) description!: string;
  @IsString() @MaxLength(80) category!: string;
  @IsOptional() @IsString() @MaxLength(80) subcategory = '';
  @IsBoolean() published!: boolean;
}
class BarcodeQuery {
  @IsString() @MinLength(1) @MaxLength(64) code!: string;
}
class ListQuery {
  @IsOptional() @IsString() @MaxLength(128) q = '';
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsIn(['true', 'false']) archived?: string;
}
@Controller('shops/:shopId/variants')
@UseGuards(AuthGuard)
export class VariantsController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly variants: VariantsService,
  ) {}
  @Get() async list(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Query() query: ListQuery,
  ) {
    const member = await this.access.requireMembership(
      req.userId,
      shopId,
      'read',
    );
    return this.variants.list(
      shopId,
      query.q,
      query.page,
      query.pageSize,
      member.role !== 'cashier' || member.canViewReports,
      query.archived === 'true',
    );
  }
  @Post() async create(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Body() body: VariantDto,
    @Headers('idempotency-key') key: string,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'catalog');
    return this.variants.createVariant(shopId, body, req.userId, key);
  }
  @Get('by-barcode') async barcode(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Query() query: BarcodeQuery,
  ) {
    const member = await this.access.requireMembership(
      req.userId,
      shopId,
      'read',
    );
    const variant = await this.variants.findByBarcode(
      shopId,
      query.code,
      member.role !== 'cashier',
    );
    if (!variant) throw new NotFoundException();
    return variant;
  }
  @Put(':variantId/archive') async archive(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('variantId', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'catalog');
    return this.variants.archiveVariant(shopId, id, req.userId);
  }
  @Put(':variantId/unarchive') async unarchive(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('variantId', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'catalog');
    return this.variants.unarchiveVariant(shopId, id, req.userId);
  }
  @Get(':variantId/variants') async getVariantsGroup(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('variantId', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'read');
    return this.variants.getVariantsGroup(shopId, id);
  }
  @Put(':variantId/photos') async replacePhotos(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('variantId', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
    @Body() body: ReplaceAlbumDto,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'catalog');
    return this.variants.replacePhotoAlbum(
      shopId,
      id,
      body.photoDataUrls,
      req.userId,
    );
  }
  @Put(':variantId') async update(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('variantId', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
    @Body() body: EditVariantDto,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'catalog');
    return this.variants.updateVariant(shopId, id, body, req.userId);
  }
  @Get(':variantId') async get(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('variantId', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'read');
    return this.variants.getById(shopId, id);
  }
}
