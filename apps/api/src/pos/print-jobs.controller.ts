import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from '../shops/shop-access.service';
import { ShopEventsService } from '../shops/shop-events.service';
import { PrintJobKind, PrintJobsService } from './print-jobs.service';

class CreatePrintJobDto {
  @IsIn(['label', 'receipt'])
  kind!: PrintJobKind;

  @IsObject()
  payload!: Record<string, unknown>;
}

class FailPrintJobDto {
  @IsOptional()
  @IsString()
  error?: string;
}

@Controller('shops/:shopId/print-jobs')
@UseGuards(AuthGuard)
export class PrintJobsController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly printJobs: PrintJobsService,
    private readonly events: ShopEventsService,
  ) {}

  @Post()
  async create(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Body() dto: CreatePrintJobDto,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    const job = await this.printJobs.create(
      shopId,
      req.userId,
      dto.kind,
      dto.payload,
    );
    this.events.emit(shopId, 'print-job');
    return job;
  }

  @Get()
  async list(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    return {
      items: await this.printJobs.list(
        shopId,
        status,
        limit ? Number(limit) : 30,
      ),
    };
  }

  @Post(':jobId/claim')
  async claim(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    const job = await this.printJobs.claim(shopId, jobId);
    this.events.emit(shopId, 'print-job');
    return job;
  }

  @Post(':jobId/complete')
  async complete(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    const job = await this.printJobs.complete(shopId, jobId);
    this.events.emit(shopId, 'print-job');
    return job;
  }

  @Post(':jobId/fail')
  async fail(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Req() req: UserRequest,
    @Body() dto: FailPrintJobDto,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    const job = await this.printJobs.fail(
      shopId,
      jobId,
      dto.error || 'Ошибка печати',
    );
    this.events.emit(shopId, 'print-job');
    return job;
  }

  @Delete(':jobId')
  async remove(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Req() req: UserRequest,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'sell');
    const res = await this.printJobs.remove(shopId, jobId);
    this.events.emit(shopId, 'print-job');
    return res;
  }
}
