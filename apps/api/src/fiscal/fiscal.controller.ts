import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { FiscalService } from './fiscal.service';

@Controller('shops/:shopId/fiscal')
@UseGuards(AuthGuard)
export class FiscalController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly fiscal: FiscalService,
  ) {}

  @Get('status')
  async status(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shop, 'reports');
    return this.fiscal.status();
  }

  @Get('sales/:saleId')
  async receipt(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('saleId', ParseUUIDPipe) sale: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shop, 'reports');
    return this.fiscal.receipt(shop, sale);
  }

  @Post('sales/:saleId')
  async request(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('saleId', ParseUUIDPipe) sale: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shop, 'reports');
    return this.fiscal.request(shop, sale, req.userId);
  }
}
