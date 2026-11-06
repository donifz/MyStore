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
    res.cookie('mystore_buyer_session', session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 43200000,
    });
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
