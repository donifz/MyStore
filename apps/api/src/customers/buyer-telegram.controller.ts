import {
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Body,
  UseGuards,
} from '@nestjs/common';
import { BuyerAuthGuard, BuyerRequest } from './buyer-auth.guard';
import { BuyerTelegramService } from './buyer-telegram.service';

@Controller('buyer/telegram')
@UseGuards(BuyerAuthGuard)
export class BuyerTelegramController {
  constructor(private readonly telegram: BuyerTelegramService) {}

  @Get('config')
  config() {
    return this.telegram.config();
  }

  @Post('start')
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
