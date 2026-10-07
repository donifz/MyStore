import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { ReturnsService } from './returns.service';
import { PaymentMethod, ReturnInput } from './pos.types';
class ReturnLineDto {
  @IsUUID() saleLineId!: string;
  @IsInt() @Min(1) @Max(1000000000) quantity!: number;
  @IsIn(['resellable', 'defective']) condition!: 'resellable' | 'defective';
}
class ReturnDto implements ReturnInput {
  @IsUUID() saleId!: string;
  @IsOptional() @IsUUID() shiftId?: string;
  @IsOptional() @IsIn(['cash', 'card']) method?: PaymentMethod;
  @IsBoolean() refundMoney!: boolean;
  @IsString() @MaxLength(500) reason!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  lines!: ReturnLineDto[];
}
@Controller('shops/:shopId/pos/returns')
@UseGuards(AuthGuard)
export class ReturnsController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly returns: ReturnsService,
  ) {}
  @Post() async create(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Headers('idempotency-key') key: string,
    @Body() dto: ReturnDto,
  ) {
    const m = await this.access.requireMembership(req.userId, shop, 'read');
    if (m.role !== 'owner') throw new ForbiddenException();
    return this.returns.return(shop, req.userId, key, dto);
  }
}
