import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService, ShopPermission } from './shop-access.service';
class PermissionQuery {
  @IsOptional()
  @IsIn(['read', 'receive', 'sell', 'catalog'])
  permission?: ShopPermission;
}
@Controller('shops')
@UseGuards(AuthGuard)
export class ShopsController {
  constructor(private readonly access: ShopAccessService) {}
  @Get(':shopId/access') getAccess(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Query() query: PermissionQuery,
    @Req() req: UserRequest,
  ) {
    return this.access.requireMembership(
      req.userId,
      shopId,
      query.permission ?? 'read',
    );
  }
}
