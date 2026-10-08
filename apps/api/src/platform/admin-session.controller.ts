import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, UserRequest } from '../auth/auth.guard';
import { PlatformAdminService } from './platform-admin.service';

@Controller('platform/admin')
@UseGuards(AuthGuard)
export class AdminSessionController {
  constructor(private readonly admins: PlatformAdminService) {}

  @Get('session') async session(@Req() req: UserRequest) {
    await this.admins.requireAdmin(req.userId);
    return { platformAdmin: true };
  }
}
