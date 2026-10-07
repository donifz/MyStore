import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard, UserRequest } from './auth.guard';
import { csrfFor, validateOrigin } from './browser-security';
class WebLoginDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(256) password!: string;
}
@Controller('auth')
export class WebAuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('web/login') async login(
    @Body() body: WebLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    validateOrigin(req.headers.origin);
    this.auth.limitLogin(req.ip ?? 'unknown');
    const session = await this.auth.login(body.email, body.password);
    res.cookie('mystore_session', session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 43200000,
    });
    return { expiresIn: 43200, csrfToken: csrfFor(session.token) };
  }
  @Get('me') @UseGuards(AuthGuard) async me(@Req() req: UserRequest) {
    return {
      ...(await this.auth.me(req.userId)),
      csrfToken: csrfFor(req.token),
    };
  }
  @Post('web/logout') @UseGuards(AuthGuard) async logout(
    @Req() req: UserRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.logout(req.token);
    res.clearCookie('mystore_session', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return result;
  }
}
