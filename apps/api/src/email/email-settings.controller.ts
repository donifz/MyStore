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
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { EmailSettingsService } from './email-settings.service';
class PreferencesDto {
  @IsBoolean() orders!: boolean;
  @IsBoolean() moderation!: boolean;
}
@Controller('shops/:shopId/email')
@UseGuards(AuthGuard)
export class EmailSettingsController {
  constructor(private readonly email: EmailSettingsService) {}
  @Get('status') status(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() r: UserRequest,
  ) {
    return this.email.status(shop, r.userId);
  }
  @Get('preferences') preferences(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() r: UserRequest,
  ) {
    return this.email.preferences(shop, r.userId);
  }
  @Post('preferences') save(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Req() r: UserRequest,
    @Body() b: PreferencesDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.email.save(shop, r.userId, b.orders, b.moderation, key);
  }
  @Post('deliveries/:id/retry') retry(
    @Param('shopId', ParseUUIDPipe) shop: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: UserRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return this.email.retry(shop, r.userId, id, key);
  }
}
