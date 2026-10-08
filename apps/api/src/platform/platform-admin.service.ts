import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATABASE } from '../database';

@Injectable()
export class PlatformAdminService {
  constructor(@Inject(DATABASE) private readonly db: DataSource) {}

  async requireAdmin(userId: string): Promise<void> {
    const [admin] = await this.db.query(
      'SELECT 1 FROM platform_admins WHERE user_id=$1',
      [userId],
    );
    if (!admin) throw new ForbiddenException();
  }
}
