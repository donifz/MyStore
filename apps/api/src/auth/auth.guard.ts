import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  sessionCookie,
  validateCsrf,
  validateOrigin,
} from './browser-security';
export type UserRequest = Request & {
  userId: string;
  token: string;
  authMode: 'bearer' | 'cookie';
};
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<UserRequest>();
    const cookie = sessionCookie(req.headers.cookie);
    const header = req.headers.authorization;
    const token =
      cookie ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!token) throw new UnauthorizedException();
    req.authMode = cookie ? 'cookie' : 'bearer';
    req.token = token;
    req.userId = await this.auth.authenticate(token);
    if (cookie && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      validateOrigin(req.headers.origin);
      validateCsrf(token, req.headers['x-csrf-token']);
    }
    return true;
  }
}
