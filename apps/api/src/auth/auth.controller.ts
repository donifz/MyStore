import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
class LoginDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(256) password!: string;
}
@Controller('auth')
export class AuthController {
  private attempts = new Map<string, { count: number; until: number }>();
  constructor(private readonly auth: AuthService) {}
  @Post('login') async login(@Body() body: LoginDto, @Req() req: Request) {
    const now = Date.now();
    for (const [key, value] of this.attempts)
      if (value.until <= now) this.attempts.delete(key);
    const key = req.ip ?? 'unknown';
    const row = this.attempts.get(key) ?? { count: 0, until: now + 60000 };
    if (
      row.count >= 20 ||
      (this.attempts.size >= 10000 && !this.attempts.has(key))
    )
      throw new HttpException('Too many attempts', 429);
    row.count++;
    this.attempts.set(key, row);
    return this.auth.login(body.email, body.password);
  }
  @Post('logout') @UseGuards(AuthGuard) logout(@Req() req: Request) {
    return this.auth.logout(req.headers.authorization!.slice(7));
  }
}
