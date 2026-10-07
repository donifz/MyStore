import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { Response } from 'express';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { VariantDto } from './variants.controller';
import { CaptureService } from './capture.service';
class CaptureDto extends VariantDto {
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) unitCostMinor!: number;
  @IsInt() @Min(1) @Max(1000000) quantity!: number;
  @IsString() @MaxLength(700000) photoDataUrl!: string;
  @IsString() @MaxLength(80) category!: string;
  @IsString() @MaxLength(2000) description!: string;
}
@Controller('shops/:shopId/variants')
@UseGuards(AuthGuard)
export class CaptureController {
  constructor(
    private readonly captureService: CaptureService,
    private readonly access: ShopAccessService,
  ) {}
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
    @Res() res: Response,
  ) {
    await this.access.requireMembership(req.userId, shop, 'read');
    res.setHeader('Cache-Control', 'no-store');
    res.type('image/jpeg').send(await this.captureService.photo(shop, id));
  }
}
