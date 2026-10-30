
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ProfesoresService } from './profesores.service';
import { CreateProfesorDto } from './dto/create-profesor.dto';
import { UpdateProfesorDto } from './dto/update-profesor.dto';

import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CsrfGuard } from '../../auth/guards/csrf.guard';

@Controller('horario/profesores')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
export class ProfesoresController {
  constructor(
    private readonly profesoresService: ProfesoresService,
  ) {}

  // GET /api/horario/profesores
  @Get()
  @Roles('jefatura')
  findAll() {
    return this.profesoresService.findAll();
  }

   // GET /api/horario/profesores/usuarios-disponibles
  @Get('usuarios-disponibles')
  @Roles('jefatura')
  findUsuariosDisponibles() {
    return this.profesoresService.findUsuariosDisponibles();
  }

  // GET /api/horario/profesores/:id
  @Get(':id')
  @Roles('jefatura')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.profesoresService.findOne(id);
  }

  // POST /api/horario/profesores
  @Post()
  @Roles('jefatura')
  @UseGuards(CsrfGuard)
  create(@Body() dto: CreateProfesorDto) {
    return this.profesoresService.create(dto);
  }

  // PATCH /api/horario/profesores/:id
  @Patch(':id')
  @Roles('jefatura')
  @UseGuards(CsrfGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProfesorDto,
  ) {
    return this.profesoresService.update(id, dto);
  }

  // DELETE /api/horario/profesores/:id
  @Delete(':id')
  @Roles('jefatura')
  @UseGuards(CsrfGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.profesoresService.remove(id);
  }
}
