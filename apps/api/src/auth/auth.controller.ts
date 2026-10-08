import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
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
  constructor(private readonly auth: AuthService) {}
  @Post('login') async login(@Body() body: LoginDto, @Req() req: Request) {
    this.auth.limitLogin(req.ip ?? 'unknown', body.email);
    return this.auth.login(body.email, body.password);
  }
  @Post('logout') @UseGuards(AuthGuard) logout(@Req() req: Request) {
    return this.auth.logout((req as import('./auth.guard').UserRequest).token);
  }
}
