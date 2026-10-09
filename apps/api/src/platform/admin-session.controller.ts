import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { PlatformAdminService } from './platform-admin.service';

@Controller('platform/admin')
@UseGuards(AuthGuard)
export class AdminSessionController {
  constructor(private readonly admins: PlatformAdminService) {}

  @Get('overview') async overview(@Req() req: UserRequest) {
    await this.admins.requireAdmin(req.userId);
    try {
      return await this.admins.overview();
    } catch (error) {
      console.error('Admin overview query failed', error);
      throw error;
    }
  }

  @Get('session') async session(@Req() req: UserRequest) {
    await this.admins.requireAdmin(req.userId);
    return { platformAdmin: true };
  }
}
