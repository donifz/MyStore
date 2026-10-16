import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Query,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  IsInt,
  Matches,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Response } from 'express';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { VariantFieldsDto } from './variants.controller';
import { CaptureService } from './capture.service';
import { PhotoAssistantService } from './photo-assistant.service';
import { AuthService } from '../auth/auth.service';
import { VariantsService } from './variants.service';
import { BarcodeLookupService } from './barcode-lookup.service';
class PhotoSuggestionDto {
  @IsString() @MaxLength(700000) photoDataUrl!: string;
}
class BarcodeLookupQuery {
  @IsString() @Matches(/^\d{8,14}$/) code!: string;
}
class CaptureDto extends VariantFieldsDto {
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) unitCostMinor!: number;
  @IsInt() @Min(1) @Max(1000000) quantity!: number;
  @IsString() @MaxLength(700000) photoDataUrl!: string;
  @IsString() @MaxLength(80) category = '';
  @IsOptional() @IsString() @MaxLength(80) subcategory = '';
  @IsString() @MaxLength(2000) description!: string;
}
@Controller('shops/:shopId/variants')
@UseGuards(AuthGuard)
export class CaptureController {
  constructor(
    private readonly captureService: CaptureService,
    private readonly access: ShopAccessService,
    private readonly assistant: PhotoAssistantService,
    private readonly auth: AuthService,
    private readonly variants: VariantsService,
    private readonly barcodeLookup: BarcodeLookupService,
  ) {}
  @Get('barcode-suggestion') async barcodeSuggestion(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Query() query: BarcodeLookupQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.access.requireMembership(req.userId, shop, 'receive');
    res.setHeader('Cache-Control', 'no-store');
    const existing = await this.variants.findByBarcode(shop, query.code);
    if (existing) return { source: 'shop', found: true, existing };
    this.auth.limitLogin(`barcode-lookup:${shop}:${req.userId}`);
    return this.barcodeLookup.lookup(query.code);
  }
  @Get('photo-assistant') async assistantInfo(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.access.requireMembership(req.userId, shop, 'receive');
    res.setHeader('Cache-Control', 'no-store');
    return this.assistant.info(shop);
  }
  @Post('photo-assistant') async suggest(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Body() body: PhotoSuggestionDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.access.requireMembership(req.userId, shop, 'receive');
    this.auth.limitLogin(`photo-ai:${shop}:${req.userId}`);
    res.setHeader('Cache-Control', 'no-store');
    return this.assistant.suggest(shop, body.photoDataUrl);
  }
  @Post('capture') async capture(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() body: CaptureDto,
  ) {
    await this.access.requireMembership(req.userId, shop, 'receive');
    return this.captureService.capture(shop, req.userId, key, body);
  }
  @Get(':id/photo') async photo(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
    @Query('index') index: string | undefined,
    @Res() res: Response,
  ) {
    await this.access.requireMembership(req.userId, shop, 'read');
    res.setHeader('Cache-Control', 'no-store');
    const photoIndex = index === undefined ? 0 : Number(index);
    res
      .type('image/jpeg')
      .send(await this.captureService.photo(shop, id, undefined, photoIndex));
  }
}
