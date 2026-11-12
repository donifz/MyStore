import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { csrfFor, validateOrigin } from '../auth/browser-security';
import { setBuyerSessionCookie } from './buyer-auth.controller';
import { BuyerAuthGuard, BuyerRequest } from './buyer-auth.guard';
import { BuyerAuthService } from './buyer-auth.service';
import { BuyerTelegramService } from './buyer-telegram.service';

@Controller('buyer/telegram')
export class BuyerTelegramController {
  constructor(
    private readonly telegram: BuyerTelegramService,
    private readonly buyers: BuyerAuthService,
  ) {}

  @Get('config')
  config() {
    return this.telegram.config();
  }

  @Post('auth-request')
  async authRequest(@Req() req: Request) {
    validateOrigin(req.headers.origin);
    this.buyers.limit('tg-auth:' + (req.ip ?? 'unknown'));
    return this.telegram.requestAuth();
  }

  @Post('auth-poll')
  @HttpCode(200)
  async authPoll(
    @Body() body: { token: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    validateOrigin(req.headers.origin);
    const result = await this.telegram.pollAuth(body.token);
    if (result.status === 'ready' && result.token) {
      setBuyerSessionCookie(res, result.token);
      return {
        status: 'ready' as const,
        csrfToken: csrfFor(result.token),
      };
    }
    return result;
  }

  @Post('start')
  @UseGuards(BuyerAuthGuard)
  async start(@Req() req: BuyerRequest) {
    return this.telegram.issue(req.buyerId);
  }
}

@Controller('integrations/telegram')
export class TelegramWebhookController {
  constructor(private readonly telegram: BuyerTelegramService) {}

  @Post('buyer-webhook')
  webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string,
    @Body() update: object,
  ) {
    return this.telegram.webhook(secret, update);
  }
}
