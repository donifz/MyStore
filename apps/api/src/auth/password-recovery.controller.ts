import { Body, Controller, Headers, Post, Req, Res } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { validateOrigin } from './browser-security';
import { PasswordRecoveryService } from './password-recovery.service';
class ForgotDto {
  @IsEmail() @MaxLength(254) email!: string;
}
class ResetDto {
  @IsString() @MinLength(64) @MaxLength(64) token!: string;
  @IsString() @MinLength(12) @MaxLength(256) password!: string;
}
@Controller('auth/password')
export class PasswordRecoveryController {
  constructor(
    private readonly recovery: PasswordRecoveryService,
    private readonly auth: AuthService,
  ) {}
  @Post('forgot') forgot(
    @Body() b: ForgotDto,
    @Req() r: Request,
    @Headers('idempotency-key') key: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    validateOrigin(r.headers.origin);
    res.setHeader('Cache-Control', 'no-store');
    this.auth.limitLogin('recovery:' + (r.ip || 'unknown'), b.email);
    return this.recovery.request(b.email, key);
  }
  @Post('reset') reset(
    @Body() b: ResetDto,
    @Req() r: Request,
    @Headers('idempotency-key') key: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    validateOrigin(r.headers.origin);
    res.setHeader('Cache-Control', 'no-store');
    this.auth.limitLogin('reset:' + (r.ip || 'unknown'));
    return this.recovery.reset(b.token, b.password, key);
  }
}
