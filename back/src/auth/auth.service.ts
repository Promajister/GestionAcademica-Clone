import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { JwtAccessPayload, JwtRefreshPayload } from './types/jwt-payload';

type SafeUser = {
  id: number;
  email: string;
  nombre: string;
  role: string;
  activo: boolean;
};

@Injectable()
export class AuthService {
  private accessTtl = Number(process.env.ACCESS_TTL ?? 900); // seconds
  private refreshTtl = Number(process.env.REFRESH_TTL ?? 1209600); // seconds (14d)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly refreshRepo: RefreshTokenRepository,
  ) {}

  private cookieConfig() {
    const sameSiteEnv = (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax';
    // Permitir configurar secure explícitamente (útil en localhost http)
    const secureEnv =
      typeof process.env.COOKIE_SECURE !== 'undefined'
        ? process.env.COOKIE_SECURE === 'true'
        : process.env.NODE_ENV === 'production';
    return {
      accessTtl: this.accessTtl,
      refreshTtl: this.refreshTtl,
      sameSite: sameSiteEnv,
      secure: secureEnv,
    };
  }

  getCookieConfig() {
    return this.cookieConfig();
  }

  private toSafeUser(user: any): SafeUser {
    const { password, ...rest } = user;
    return rest;
  }

  private async validateUser(email: string, password: string) {
    const user = await this.prisma.usuario.findUnique({ where: { email } });
    if (!user || !user.activo) return null;
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return null;
    return user;
  }

  private async signTokens(user: SafeUser) {
    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const refreshId = randomUUID();
    const refreshPayload: JwtRefreshPayload = { ...accessPayload, jti: refreshId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: this.accessTtl,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: this.refreshTtl,
      }),
    ]);

    const csrfToken = randomBytes(16).toString('hex');
    return { accessToken, refreshToken, refreshId, csrfToken };
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const safeUser = this.toSafeUser(user);
    const tokens = await this.signTokens(safeUser);

    await this.refreshRepo.save({
      id: tokens.refreshId,
      userId: safeUser.id,
      hashedToken: await bcrypt.hash(tokens.refreshToken, 10),
      expiresAt: new Date(Date.now() + this.refreshTtl * 1000),
      revoked: false,
    });

    return { tokens, user: safeUser, cookieCfg: this.cookieConfig() };
  }

  async refresh(payload: JwtRefreshPayload & { refreshToken: string }) {
    const record = await this.refreshRepo.find(payload.jti);
    if (!record || record.userId !== payload.sub || record.revoked) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expirado');
    }
    const matches = await bcrypt.compare(payload.refreshToken, record.hashedToken);
    if (!matches) throw new UnauthorizedException('Refresh token inválido');

    const user = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!user || !user.activo) {
      await this.refreshRepo.revoke(payload.jti);
      throw new UnauthorizedException('Usuario inactivo o no encontrado');
    }

    await this.refreshRepo.revoke(payload.jti);

    const safeUser = this.toSafeUser(user);
    const tokens = await this.signTokens(safeUser);
    await this.refreshRepo.save({
      id: tokens.refreshId,
      userId: safeUser.id,
      hashedToken: await bcrypt.hash(tokens.refreshToken, 10),
      expiresAt: new Date(Date.now() + this.refreshTtl * 1000),
      revoked: false,
    });

    return { tokens, user: safeUser, cookieCfg: this.cookieConfig() };
  }

  async logout(payload?: JwtRefreshPayload) {
    if (payload?.jti) {
      await this.refreshRepo.revoke(payload.jti);
    }
    return;
  }
}
