import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { setAuthCookies, clearAuthCookies } from './utils/cookies.util';
import { JwtCookieAuthGuard } from './guards/jwt-cookie-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtRefreshPayload } from './types/jwt-payload';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private makePublicUrl(req: Request, path?: string | null) {
    if (!path) return path ?? null;
    if (/^https?:\/\//i.test(path)) return path;
    const prefix = path.startsWith('/') ? '' : '/';
    return `${req.protocol}://${req.get('host')}${prefix}${path}`;
  }

  private resolveFotoUrl(req: Request, fotoUrl?: string | null) {
    if (!fotoUrl) return null;

    let filePath = fotoUrl;
    if (/^https?:\/\//i.test(filePath)) {
      try {
        filePath = new URL(filePath).pathname;
      } catch {
        return null;
      }
    }

    if (!filePath.startsWith('/uploads')) {
      filePath = `/uploads/${filePath.replace(/^\/+/, '')}`;
    }

    const fsPath = join(process.cwd(), filePath);
    if (!existsSync(fsPath)) {
      return null;
    }

    return this.makePublicUrl(req, filePath);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { tokens, user, cookieCfg } = await this.auth.login(dto.email, dto.password);
    setAuthCookies(res, tokens, cookieCfg);
    const userWithUrl = { ...user, fotoUrl: this.resolveFotoUrl(req, user.fotoUrl) };
    return { user: userWithUrl, csrfToken: tokens.csrfToken, accessToken: tokens.accessToken };
  }

  @Post('refresh')
  @UseGuards(CsrfGuard, JwtRefreshGuard)
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const payload = req.user as JwtRefreshPayload & { refreshToken: string };
    const { tokens, user, cookieCfg } = await this.auth.refresh(payload);
    setAuthCookies(res, tokens, cookieCfg);
    const userWithUrl = { ...user, fotoUrl: this.resolveFotoUrl(req, user.fotoUrl) };
    return { ok: true, user: userWithUrl, csrfToken: tokens.csrfToken, accessToken: tokens.accessToken };
  }

  @Post('logout')
  @UseGuards(CsrfGuard, JwtRefreshGuard)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const payload = req.user as JwtRefreshPayload;
    await this.auth.logout(payload);
    clearAuthCookies(res, this.auth.getCookieConfig());
    return { ok: true };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return {
      ok: true,
      message: 'Si el correo existe, enviaremos una contrasena provisional al correo registrado.',
    };
  }

  @Get('me')
  @UseGuards(JwtCookieAuthGuard)
  async me(@Req() req: Request) {
    if (!req.user) throw new UnauthorizedException();
    const safeUser = await this.auth.findSafeUser((req.user as any)?.sub);
    if (!safeUser) throw new UnauthorizedException();
    return { ...safeUser, fotoUrl: this.resolveFotoUrl(req, safeUser.fotoUrl) };
  }

  @Post('protected-example')
  @UseGuards(CsrfGuard, JwtCookieAuthGuard)
  example(@Req() req: Request) {
    return { ok: true, user: req.user };
  }

  @Post('change-password')
  @UseGuards(CsrfGuard, JwtCookieAuthGuard)
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    const userId = Number(req.user?.sub);
    if (!userId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('La confirmacion no coincide con la nueva contrasena');
    }
    await this.auth.changePassword(userId, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }

  @Post('avatar')
  @UseGuards(CsrfGuard, JwtCookieAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dest = join(process.cwd(), 'uploads', 'avatars');
          if (!existsSync(dest)) {
            mkdirSync(dest, { recursive: true });
          }
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const userId = (req as any)?.user?.sub ?? 'user';
          cb(null, `user-${userId}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const isImage = file.mimetype?.startsWith('image/');
        if (!isImage) {
          return cb(new BadRequestException('Solo se permiten imagenes'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 1.5 * 1024 * 1024 }, // ~1.5MB
    }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('Archivo no recibido o invalido');
    }

    const userId = Number(req.user?.sub);
    if (!userId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const relativePath = `/uploads/avatars/${file.filename}`;
    const publicUrl = this.makePublicUrl(req, relativePath);

    // Si existe una foto anterior con el mismo nombre (mismo usuario), se reemplaza automaticamente
    // Si se quisiera borrar una foto con otro nombre, habria que consultar fotoUrl y eliminar el archivo
    const updated = await this.auth.updateAvatar(userId, relativePath);
    const userWithUrl = { ...updated, fotoUrl: this.resolveFotoUrl(req, relativePath) };
    return { ok: true, url: publicUrl, user: userWithUrl };
  }
}
