import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { JwtAccessPayload, JwtRefreshPayload } from './types/jwt-payload';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

type SafeUser = {
  id: number;
  email: string;
  nombre: string;
  role: string;
  activo: boolean;
  fotoUrl?: string | null;
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
    // Permitir configurar secure explicitamente (util en localhost http)
    const secureEnv =
      typeof process.env.COOKIE_SECURE !== 'undefined'
        ? process.env.COOKIE_SECURE === 'true'
        : process.env.NODE_ENV === 'production';
    // En HTTP (localhost), SameSite=None se bloquea si no va con Secure; forzamos lax en ese caso.
    const sameSite = !secureEnv && sameSiteEnv === 'none' ? 'lax' : sameSiteEnv;
    return {
      accessTtl: this.accessTtl,
      refreshTtl: this.refreshTtl,
      sameSite,
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

  async findSafeUser(userId: number): Promise<SafeUser | null> {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user) return null;
    return this.toSafeUser(user);
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
      throw new UnauthorizedException('Credenciales invalidas');
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
      throw new UnauthorizedException('Refresh token invalido');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expirado');
    }
    const matches = await bcrypt.compare(payload.refreshToken, record.hashedToken);
    if (!matches) throw new UnauthorizedException('Refresh token invalido');

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

  async updateAvatar(userId: number, fotoUrl: string) {
    const current = await this.prisma.usuario.findUnique({ where: { id: userId } });

    // Borrar archivo anterior si existia y es diferente al nuevo
    if (current?.fotoUrl) {
      let prevPath = current.fotoUrl;
      if (prevPath.startsWith('http')) {
        try {
          prevPath = new URL(prevPath).pathname;
        } catch {
          prevPath = current.fotoUrl;
        }
      }
      if (!prevPath.startsWith('/uploads')) {
        prevPath = `/uploads/${prevPath.replace(/^\/+/, '')}`;
      }

      let newPath = fotoUrl;
      if (newPath.startsWith('http')) {
        try {
          newPath = new URL(newPath).pathname;
        } catch {
          newPath = fotoUrl;
        }
      }
      if (!newPath.startsWith('/uploads')) {
        newPath = `/uploads/${newPath.replace(/^\/+/, '')}`;
      }

      if (prevPath !== newPath) {
        try {
          const fsPath = join(process.cwd(), prevPath);
          if (existsSync(fsPath)) unlinkSync(fsPath);
        } catch {
          // Ignorar errores al borrar
        }
      }
    }

    const updated = await this.prisma.usuario.update({
      where: { id: userId },
      data: { fotoUrl },
    });
    return this.toSafeUser(updated);
  }

  async logout(payload?: JwtRefreshPayload) {
    if (payload?.jti) {
      await this.refreshRepo.revoke(payload.jti);
    }
    return;
  }
}
