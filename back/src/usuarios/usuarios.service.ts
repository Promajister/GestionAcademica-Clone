import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdateRolPermisosDto } from './dto/update-rol-permisos.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  list(incluirInactivos = false) {
    return this.prisma.usuario.findMany({
      where: incluirInactivos ? {} : { activo: true },
      orderBy: { id: 'asc' },
      include: {
        rol: {
          include: { permisos: true },
        },
      },
    });
  }

  async create(dto: CreateUsuarioDto) {
    const existing = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('El correo ya está registrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.usuario.create({
      data: {
        email: dto.email,
        nombre: dto.nombre,
        role: dto.role,
        rolId: dto.rolId,
        activo: dto.activo ?? true,
        password: passwordHash,
      },
      include: {
        rol: { include: { permisos: true } },
      },
    });
  }

  async update(id: number, dto: UpdateUsuarioDto) {
    const user = await this.prisma.usuario.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const data: any = {
      email: dto.email ?? user.email,
      nombre: dto.nombre ?? user.nombre,
      role: dto.role ?? user.role,
      rolId: dto.rolId ?? user.rolId,
      activo: dto.activo ?? user.activo,
    };

    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.usuario.update({
      where: { id },
      data,
      include: { rol: { include: { permisos: true } } },
    });
  }

  async updateEstado(id: number, activo: boolean) {
    const user = await this.prisma.usuario.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    return this.prisma.usuario.update({
      where: { id },
      data: { activo },
      include: { rol: { include: { permisos: true } } },
    });
  }

  getPermisos() {
    return this.prisma.permiso.findMany({
      orderBy: { clave: 'asc' },
    });
  }

  getRolesConPermisos() {
    return this.prisma.rol.findMany({
      orderBy: { id: 'asc' },
      include: { permisos: true },
    });
  }

  async updatePermisosRol(id: number, dto: UpdateRolPermisosDto) {
    const rol = await this.prisma.rol.findUnique({ where: { id } });
    if (!rol) throw new NotFoundException('Rol no encontrado');

    // Validar permisos existen
    const perms = await this.prisma.permiso.findMany({
      where: { id: { in: dto.permisosIds } },
      select: { id: true },
    });
    if (perms.length !== dto.permisosIds.length) {
      throw new BadRequestException('Algún permiso no existe');
    }

    return this.prisma.rol.update({
      where: { id },
      data: {
        permisos: {
          set: [],
          connect: dto.permisosIds.map((id) => ({ id })),
        },
      },
      include: { permisos: true },
    });
  }
}
