import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Request } from 'express';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { validateOrigin } from '../auth/browser-security';
import { PlatformAdminService } from './platform-admin.service';
import { PartnerApplicationsService } from './partner-applications.service';

class ApplicationDto {
  @IsString() @MinLength(1) @MaxLength(200) @Matches(/\S/) shopName!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(7) @MaxLength(30) phone!: string;
  @IsString() @MinLength(1) @MaxLength(80) city!: string;
  @IsString() @MaxLength(250) address!: string;
  @IsString() @MinLength(1) @MaxLength(80) category!: string;
  @IsIn(['general', 'toys', 'grocery', 'fashion', 'electronics', 'home'])
  shopType!: string;
  @Equals(true) agreed!: boolean;
}
class ActivationDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string;
  @IsString() @MinLength(12) @MaxLength(256) password!: string;
}
class DecisionDto {
  @IsIn(['new', 'in_review', 'rejected']) expectedStatus!:
    'new' | 'in_review' | 'rejected';
  @IsIn(['in_review', 'approved', 'rejected']) decision!:
    'in_review' | 'approved' | 'rejected';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
class PageQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsString() @MaxLength(128) q = '';
  @IsOptional() @IsIn(['', 'new', 'in_review', 'approved', 'rejected']) status =
    '';
  @IsOptional() @IsString() @MaxLength(80) city = '';
}

@Controller('partners')
export class PartnerApplicationsController {
  constructor(
    private readonly applications: PartnerApplicationsService,
    private readonly auth: AuthService,
  ) {}

  @Get('shop-types') shopTypes() {
    return this.applications.shopTypes();
  }

  @Post('applications') create(
    @Body() body: ApplicationDto,
    @Req() req: Request,
  ) {
    validateOrigin(req.headers.origin);
    this.auth.limitLogin('application:' + (req.ip ?? 'unknown'));
    return this.applications.create(body);
  }

  @Post('invitations/activate') activate(
    @Body() body: ActivationDto,
    @Req() req: Request,
  ) {
    validateOrigin(req.headers.origin);
    this.auth.limitLogin('activation:' + (req.ip ?? 'unknown'));
    return this.applications.activate(body.token, body.password);
  }
}

@Controller('platform/admin/applications')
@UseGuards(AuthGuard)
export class AdminApplicationsController {
  constructor(
    private readonly applications: PartnerApplicationsService,
    private readonly admins: PlatformAdminService,
  ) {}

  @Get() async list(@Req() req: UserRequest, @Query() q: PageQuery) {
    await this.admins.requireAdmin(req.userId);
    return this.applications.list(q.page, q.pageSize, q.q, q.status, q.city);
  }

  @Get(':id') async detail(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.admins.requireAdmin(req.userId);
    return this.applications.detail(id);
  }

  @Post(':id/decision') async decide(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DecisionDto,
  ) {
    await this.admins.requireAdmin(req.userId);
    return this.applications.decide(id, req.userId, body);
  }
}
