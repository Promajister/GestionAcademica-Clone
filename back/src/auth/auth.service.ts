import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { JwtAccessPayload, JwtRefreshPayload } from './types/jwt-payload';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createTransport } from 'nodemailer';

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
  private accessTtl = Number(process.env.ACCESS_TTL ?? 3600); // seconds
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

  private async sendProvisionalEmail(to: string, provisional: string, name?: string | null) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com';

    // Si no hay config SMTP, evitamos fallo y dejamos trazabilidad
    if (!host || !user || !pass) {
      console.warn('[auth] SMTP no configurado; no se envio correo de recuperacion.');
      return;
    }

    const transporter = createTransport({
      host,
      port,
      secure: port === 465 || process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });

    const safeName = name || 'usuario';
    const subject = 'Recuperacion de contrasena';
    const text = `Hola ${safeName},

Se genero una contrasena provisional para tu cuenta: ${provisional}

Inicia sesion y cambia tu contrasena cuanto antes.

Si no solicitaste este cambio, contacta al administrador.`;

    const html = `<p>Hola ${safeName},</p>
<p>Se gener&oacute; una contrase&ntilde;a provisional para tu cuenta:</p>
<p><strong>${provisional}</strong></p>
<p>Inicia sesi&oacute;n y cambia tu contrase&ntilde;a cuanto antes.</p>
<p>Si no solicitaste este cambio, contacta al administrador.</p>`;

    await transporter.sendMail({ from, to, subject, text, html });
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.usuario.findUnique({ where: { email } });
    // No revelar si el correo existe
    if (!user || !user.activo) {
      return;
    }

    // Generar contrasena provisional aleatoria (12 chars)
    const provisional = randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    const hashed = await bcrypt.hash(provisional, 10);

    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    // Revocar refresh tokens existentes
    await this.refreshRepo.revokeAllForUser(user.id);

    // Enviar correo (si SMTP configurado). En desarrollo queda log si falla.
    try {
      await this.sendProvisionalEmail(user.email, provisional, user.nombre);
    } catch (e) {
      console.error('[auth] Error enviando correo de recuperacion', e);
    }
    return;
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user || !user.activo) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      throw new UnauthorizedException('Contrasena actual incorrecta');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('La nueva contrasena debe ser diferente');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { password: hashed },
    });

    // Revocar refresh tokens existentes para obligar a re-autenticacion
    await this.refreshRepo.revokeAllForUser(userId);
    return;
  }

  async updateProfile(userId: number, data: { nombre?: string; email?: string }) {
    const current = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!current || !current.activo) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    const updates: { nombre?: string; email?: string } = {};
    if (typeof data.nombre === 'string') updates.nombre = data.nombre.trim();
    if (typeof data.email === 'string') updates.email = data.email.trim().toLowerCase();

    if (updates.email && updates.email !== current.email) {
      const exists = await this.prisma.usuario.findUnique({ where: { email: updates.email } });
      if (exists) {
        throw new BadRequestException('El correo ya esta en uso');
      }
    }

    if (!updates.nombre && !updates.email) {
      return this.toSafeUser(current);
    }

    const updated = await this.prisma.usuario.update({
      where: { id: userId },
      data: updates,
    });
    return this.toSafeUser(updated);
  }
}
