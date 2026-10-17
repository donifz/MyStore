import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Request, Response } from 'express';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import {
  sessionCookie,
  validateOrigin,
  validateCsrf,
} from '../auth/browser-security';
import { StaffService } from './staff.service';
class RoleDto {
  @IsIn(['manager', 'cashier']) role!: 'manager' | 'cashier';
}
class PermissionsDto {
  @IsBoolean() canReturn!: boolean;
  @IsBoolean() canViewReports!: boolean;
}
class InviteDto extends RoleDto {
  @IsEmail() @MaxLength(254) email!: string;
}
class AcceptDto {
  @IsString() @MinLength(64) @MaxLength(64) token!: string;
  @IsOptional() @IsString() @MinLength(12) @MaxLength(256) password?: string;
}
@Controller('shops/:shopId/staff')
@UseGuards(AuthGuard)
export class StaffController {
  constructor(private readonly staff: StaffService) {}
  @Get() list(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() r: UserRequest,
  ) {
    return this.staff.list(shop, r.userId);
  }
  @Post('invitations') invite(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() r: UserRequest,
    @Body() b: InviteDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.staff.invite(shop, r.userId, b.email, b.role, key);
  }
  @Post('invitations/:id/cancel') cancel(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: UserRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return this.staff.cancel(shop, r.userId, id, key);
  }
  @Post(':id/role') role(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: UserRequest,
    @Body() b: RoleDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.staff.change(shop, r.userId, id, b.role, key);
  }
  @Post(':id/permissions') permissions(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: UserRequest,
    @Body() b: PermissionsDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.staff.permissions(shop, r.userId, id, b, key);
  }
  @Post(':id/disable') disable(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: UserRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return this.staff.change(shop, r.userId, id, null, key);
  }
}
@Controller('auth/staff')
export class StaffAcceptanceController {
  constructor(
    private readonly staff: StaffService,
    private readonly auth: AuthService,
  ) {}
  @Post('accept') async accept(
    @Body() b: AcceptDto,
    @Req() r: Request,
    @Headers('idempotency-key') key: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    validateOrigin(r.headers.origin);
    this.auth.limitLogin('staff-accept:' + (r.ip || 'unknown'));
    const cookie = sessionCookie(r.headers.cookie);
    const token =
      cookie ||
      (r.headers.authorization?.startsWith('Bearer ')
        ? r.headers.authorization.slice(7)
        : undefined);
    let actor: string | undefined;
    if (token) {
      try {
        actor = await this.auth.authenticate(token);
      } catch (error) {
        if (!cookie || !(error instanceof UnauthorizedException)) throw error;
        res.clearCookie('mystore_session', {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      }
      if (cookie && actor) validateCsrf(cookie, r.headers['x-csrf-token']);
    }
    return this.staff.accept(b.token, b.password, actor, key);
  }
}
