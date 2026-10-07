import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { ReportsService } from './reports.service';

@Controller('shops/:shopId/reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly reports: ReportsService,
  ) {}

  @Get('summary')
  async summary(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() req: UserRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    await this.access.requireMembership(req.userId, shop, 'reports');
    return this.reports.summary(shop, from, to);
  }

  @Get('export/:kind.csv')
  async export(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('kind') kind: string,
    @Req() req: UserRequest,
    @Res() res: Response,
  ) {
    await this.access.requireMembership(req.userId, shop, 'reports');
    const csv = await this.reports.export(shop, kind);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mystore-${kind}.csv"`,
    );
    res.send(csv);
  }
}
