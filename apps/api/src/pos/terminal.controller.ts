import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { PosTerminalService } from './terminal.service';

class UpdateTerminalSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(700_000)
  paymentQrData?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  paymentQrLabel?: string;

  @IsOptional()
  @IsBoolean()
  showQrOnCheckout?: boolean;

  @IsOptional()
  @IsBoolean()
  printQrOnReceipt?: boolean;

  @IsOptional()
  @IsInt()
  @IsIn([58, 80])
  paperWidth?: 58 | 80;

  @IsOptional()
  @IsBoolean()
  autoPrint?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  receiptHeader?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  receiptFooter?: string;
}

class AckJobDto {
  @IsIn(['printed', 'failed'])
  status!: 'printed' | 'failed';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  error?: string;
}

@Controller('shops/:shopId/pos/terminal')
@UseGuards(AuthGuard)
export class PosTerminalController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly terminal: PosTerminalService,
  ) {}

  @Get('settings')
  async getSettings(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    return this.terminal.getSettings(shopId);
  }

  @Put('settings')
  async updateSettings(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Body() body: UpdateTerminalSettingsDto,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'catalog');
    return this.terminal.updateSettings(shopId, body);
  }

  @Get('jobs')
  async listJobs(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    return this.terminal.listJobs(shopId);
  }

  @Get('poll')
  async poll(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    let closed = false;
    req.on('close', () => {
      closed = true;
    });
    const jobs = await this.terminal.pollPendingJobs(shopId, () => closed);
    return { jobs };
  }

  @Post('jobs/:jobId/ack')
  async ackJob(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() body: AckJobDto,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    return this.terminal.ackJob(shopId, jobId, body.status, body.error);
  }

  @Post('test-print')
  async testPrint(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    return this.terminal.enqueueTestReceipt(shopId);
  }
}
