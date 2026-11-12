import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { BuyerAuthService } from './buyer-auth.service';
import { BuyerAuthGuard, BuyerRequest } from './buyer-auth.guard';
import { csrfFor, validateOrigin } from '../auth/browser-security';

class RegisterBuyerDto {
  @IsString() @MaxLength(32) phone!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(12) @MaxLength(256) password!: string;
}
class BuyerLoginDto {
  @IsString() @MaxLength(32) phone!: string;
  @IsString() @MinLength(1) @MaxLength(256) password!: string;
}
class ChangePasswordDto {
  @IsString() @MinLength(12) @MaxLength(256) password!: string;
}
class TokenLoginDto {
  @IsString() @MinLength(32) @MaxLength(128) token!: string;
}
export function setBuyerSessionCookie(res: Response, token: string) {
  res.cookie('mystore_buyer_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 43200000,
  });
}

@Controller('buyer')
export class BuyerAuthController {
  constructor(private readonly buyers: BuyerAuthService) {}
  @Post('register')
  async register(@Body() body: RegisterBuyerDto, @Req() req: Request) {
    validateOrigin(req.headers.origin);
    this.buyers.limit('register:' + (req.ip ?? 'unknown'));
    return this.buyers.register(body.phone, body.name, body.password);
  }
  @Post('login')
  async login(
    @Body() body: BuyerLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    validateOrigin(req.headers.origin);
    this.buyers.limit('login:' + (req.ip ?? 'unknown'));
    const session = await this.buyers.login(body.phone, body.password);
    setBuyerSessionCookie(res, session.token);
    return { expiresIn: session.expiresIn, csrfToken: csrfFor(session.token) };
  }
  @Get('me')
  @UseGuards(BuyerAuthGuard)
  async me(@Req() req: BuyerRequest) {
    return {
      ...(await this.buyers.me(req.buyerId)),
      csrfToken: csrfFor(req.buyerToken),
    };
  }
  @Post('token-login')
  async tokenLogin(
    @Body() body: TokenLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    validateOrigin(req.headers.origin);
    this.buyers.limit('token-login:' + (req.ip ?? 'unknown'));
    await this.buyers.authenticate(body.token);
    setBuyerSessionCookie(res, body.token);
    return { csrfToken: csrfFor(body.token) };
  }
  @Post('change-password')
  @UseGuards(BuyerAuthGuard)
  async changePassword(
    @Req() req: BuyerRequest,
    @Body() body: ChangePasswordDto,
  ) {
    validateOrigin(req.headers.origin);
    return this.buyers.changePassword(req.buyerId, body.password);
  }
  @Get('initial-password')
  @UseGuards(BuyerAuthGuard)
  async initialPassword(@Req() req: BuyerRequest) {
    return this.buyers.revealInitialPassword(req.buyerId);
  }
  @Post('logout')
  @UseGuards(BuyerAuthGuard)
  async logout(
    @Req() req: BuyerRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.buyers.logout(req.buyerToken);
    res.clearCookie('mystore_buyer_session', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    return result;
  }
}
