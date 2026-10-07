import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { CategoriesService } from './categories.service';

class CreateCategoryDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsOptional() @IsString() parentId?: string;
}

@Controller('shops/:shopId/categories')
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly categories: CategoriesService,
  ) {}

  @Get() async list(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'read');
    return this.categories.list(shopId);
  }

  @Post() async create(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Body() body: CreateCategoryDto,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'catalog');
    return this.categories.create(shopId, body.name, body.parentId);
  }
}
