import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import {
  CustomAttributeType,
  ShopCustomAttributesService,
} from './shop-custom-attributes.service';

class CreateCustomAttributeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  key?: string;

  @IsIn(['string', 'number', 'select'])
  type!: CustomAttributeType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  filterable?: boolean;
}

@Controller('shops/:shopId/custom-attributes')
@UseGuards(AuthGuard)
export class ShopCustomAttributesController {
  constructor(
    private readonly service: ShopCustomAttributesService,
    private readonly access: ShopAccessService,
  ) {}

  @Get()
  async list(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'read');
    return this.service.list(shopId);
  }

  @Post()
  async create(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Body() body: CreateCustomAttributeDto,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'catalog');
    return this.service.create(shopId, body);
  }

  @Delete(':id')
  async delete(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'catalog');
    await this.service.delete(shopId, id);
    return { ok: true };
  }
}
