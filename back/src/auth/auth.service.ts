import {Injectable,NotFoundException,BadRequestException,} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  // --------- LOGIN ---------
  async validateUser(email: string, password: string) {
    const user = await this.prisma.usuario.findUnique({ where: { email } });
    if (!user || !user.activo) return null;

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return null;

    const { password: _pwd, ...safeUser } = user;
    return safeUser;
  }

  buildLoginResponse(user: any) {
    return {
      accessToken: `fake-token-${user.id}`,
      user,
    };
  }

  // --------- RECUPERAR CONTRASEÑA ---------

  /** 1) Usuario pide recuperar contraseña: generamos token y enviamos correo */
  async requestPasswordReset(email: string) {
    const user = await this.prisma.usuario.findUnique({ where: { email } });

    // Por seguridad, aunque no exista el usuario devolvemos OK "genérico"
    if (!user || !user.activo) {
      return {
        message:
          'Si el correo existe en el sistema, se enviaron instrucciones de recuperación.',
      };
    }

    // Generar token aleatorio
    const token = crypto.randomBytes(32).toString('hex');

    // Guardar token en BD
    await this.prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
      },
    });

    // Construir link al front, ej: http://localhost:4200/reset-password?token=...
    const frontUrl = process.env.FRONT_URL || 'http://localhost:4200';
    const resetLink = `${frontUrl}/restablecer-clave?token=${token}`;

    // Enviar correo
    await this.sendResetEmail(user.email, user.nombre, resetLink);

    return {
      message:
        'Se enviaron instrucciones de recuperación al correo registrado.',
    };
  }

  /** 2) Usuario llega con token + nueva contraseña */
  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { usuario: true },
    });

    if (!record || record.used) {
      throw new BadRequestException('El enlace de recuperación no es válido.');
    }

    // Opcional: caducidad, ej. 1 hora
    const oneHour = 60 * 60 * 1000;
    if (Date.now() - record.createdAt.getTime() > oneHour) {
      throw new BadRequestException('El enlace de recuperación ha expirado.');
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: record.userId },
        data: { password: hash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ]);

    return { message: 'Tu contraseña ha sido actualizada correctamente.' };
  }

  // --------- helper para enviar correo ----------
  private async sendResetEmail(email: string, nombre: string, link: string) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const html = `
      <p>Hola ${nombre},</p>
      <p>Hemos recibido una solicitud para restablecer tu contraseña del Sistema de Prácticas.</p>
      <p>Para continuar, haz clic en el siguiente enlace:</p>
      <p><a href="${link}" target="_blank">${link}</a></p>
      <p>Si tú no solicitaste este cambio, puedes ignorar este correo.</p>
      <p>Saludos,<br/>Equipo de Prácticas</p>
    `;

    await transporter.sendMail({
      from: `"Sistema de Prácticas" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Restablecer contraseña - Sistema de Prácticas',
      html,
    });
  }
}
