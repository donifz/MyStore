import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
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
import { PlatformAdminService } from './platform-admin.service';
import { ProductModerationService } from './product-moderation.service';
class PageQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}
class DecisionDto {
  @IsIn(['approved', 'rejected']) decision!: 'approved' | 'rejected';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
@Controller('platform/admin')
@UseGuards(AuthGuard)
export class ProductModerationController {
  constructor(
    private readonly admins: PlatformAdminService,
    private readonly products: ProductModerationService,
  ) {}
  @Get('products') async list(@Req() req: UserRequest, @Query() q: PageQuery) {
    await this.admins.requireAdmin(req.userId);
    return this.products.list(q.page, q.pageSize);
  }
  @Get('products/revisions/:id') async detail(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.admins.requireAdmin(req.userId);
    return this.products.detail(id);
  }
  @Get('products/revisions/:id/photo') async photo(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('approved') approved: string,
    @Res() res: Response,
  ) {
    await this.admins.requireAdmin(req.userId);
    res.setHeader('Cache-Control', 'no-store');
    res
      .type('image/jpeg')
      .send(await this.products.photo(id, approved === 'true'));
  }
  @Post('products/revisions/:id/decision') async decide(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DecisionDto,
  ) {
    await this.admins.requireAdmin(req.userId);
    return this.products.decide(id, req.userId, body.decision, body.reason);
  }
  @Get('audit') async audit(@Req() req: UserRequest, @Query() q: PageQuery) {
    await this.admins.requireAdmin(req.userId);
    return this.products.audit(q.page, q.pageSize);
  }
}
