import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';

@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  @Get('live')
  live() {
    return { ok: true };
  }

  @Get('ready')
  async ready() {
    try {
      await this.db.query('SELECT 1');
      const [outbox] = await this.db.query(
        "SELECT count(*)::int pending,COALESCE(EXTRACT(EPOCH FROM (now()-min(created_at))),0)::int oldest_seconds FROM outbox_events WHERE processed_at IS NULL",
      );
      return {
        ok: true,
        database: true,
        outboxPending: outbox.pending,
        outboxOldestSeconds: outbox.oldest_seconds,
      };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}
