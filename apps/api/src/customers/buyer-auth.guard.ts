import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { BuyerAuthService } from './buyer-auth.service';
import { sessionCookie, validateCsrf, validateOrigin } from '../auth/browser-security';

export type BuyerRequest = Request & { buyerId: string; buyerToken: string };

@Injectable()
export class BuyerAuthGuard implements CanActivate {
  constructor(private readonly auth: BuyerAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<BuyerRequest>();
    const token = sessionCookie(req.headers.cookie, 'mystore_buyer_session');
    if (!token) throw new UnauthorizedException();
    req.buyerId = await this.auth.authenticate(token);
    req.buyerToken = token;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      validateOrigin(req.headers.origin);
      validateCsrf(token, req.headers['x-csrf-token']);
    }
    return true;
  }
}
