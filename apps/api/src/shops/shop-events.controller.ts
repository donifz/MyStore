import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { ShopAccessService } from './shop-access.service';
import { ShopEventsService } from './shop-events.service';

@Controller('shops/:shopId/events')
@UseGuards(AuthGuard)
export class ShopEventsController {
  constructor(
    private readonly access: ShopAccessService,
    private readonly events: ShopEventsService,
  ) {}

  @Get()
  async stream(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Req() req: UserRequest,
    @Res() res: Response,
  ) {
    await this.access.requireMembership(req.userId, shopId, 'read');

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write('event: connected\ndata: {}\n\n');

    const unsubscribe = this.events.subscribe(shopId, (payload) => {
      if (!res.writableEnded) {
        res.write(
          `event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`,
        );
      }
    });

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': ping\n\n');
      }
    }, 25_000);
    heartbeat.unref?.();

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      if (!res.writableEnded) {
        res.end();
      }
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
  }
}
