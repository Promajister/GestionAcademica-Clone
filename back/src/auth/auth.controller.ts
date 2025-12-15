import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { setAuthCookies, clearAuthCookies } from './utils/cookies.util';
import { JwtCookieAuthGuard } from './guards/jwt-cookie-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtRefreshPayload } from './types/jwt-payload';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { tokens, user, cookieCfg } = await this.auth.login(dto.email, dto.password);
    setAuthCookies(res, tokens, cookieCfg);
    return { user, csrfToken: tokens.csrfToken, accessToken: tokens.accessToken };
  }

  @Post('refresh')
  @UseGuards(CsrfGuard, JwtRefreshGuard)
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const payload = req.user as JwtRefreshPayload & { refreshToken: string };
    const { tokens, user, cookieCfg } = await this.auth.refresh(payload);
    setAuthCookies(res, tokens, cookieCfg);
    return { ok: true, user, csrfToken: tokens.csrfToken, accessToken: tokens.accessToken };
  }

  @Post('logout')
  @UseGuards(CsrfGuard, JwtRefreshGuard)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const payload = req.user as JwtRefreshPayload;
    await this.auth.logout(payload);
    clearAuthCookies(res, this.auth.getCookieConfig());
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtCookieAuthGuard)
  async me(@Req() req: Request) {
    if (!req.user) throw new UnauthorizedException();
    return req.user;
  }

  @Post('protected-example')
  @UseGuards(CsrfGuard, JwtCookieAuthGuard)
  example(@Req() req: Request) {
    return { ok: true, user: req.user };
  }
}
