import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdateEstadoDto } from './dto/update-estado.dto';
import { UpdateRolPermisosDto } from './dto/update-rol-permisos.dto';
import { JefaturaGuard } from './usuarios.guard';

@UseGuards(JefaturaGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  findAll(@Query('incluirInactivos') incluirInactivos?: string) {
    const flag = incluirInactivos === 'true' || incluirInactivos === '1';
    return this.usuariosService.list(flag);
  }

  @Post()
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto) {
    return this.usuariosService.update(id, dto);
  }

  @Patch(':id/estado')
  updateEstado(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEstadoDto) {
    return this.usuariosService.updateEstado(id, dto.activo);
  }

  @Get('permisos/lista')
  getPermisos() {
    return this.usuariosService.getPermisos();
  }

  @Get('roles')
  getRoles() {
    return this.usuariosService.getRolesConPermisos();
  }

  @Patch('roles/:id/permisos')
  updatePermisosRol(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRolPermisosDto,
  ) {
    return this.usuariosService.updatePermisosRol(id, dto);
  }
}
