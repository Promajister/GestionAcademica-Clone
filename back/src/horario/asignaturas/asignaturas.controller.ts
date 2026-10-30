import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AsignaturasService } from './asignaturas.service';
import { CreateAsignaturaDto } from './dto/create-asignatura.dto';
import { UpdateAsignaturaDto } from './dto/update-asignatura.dto';
import { QueryAsignaturaDto } from './dto/query-asignatura.dto';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { BloquesService } from '../bloques/bloques.service';
import { CreateBloquesExternosDto } from '../bloques/dto/bloque-externo.dto';

// Sin @Roles por ahora: los perfiles del módulo Horario se definen en ADM-F04
@Controller('horario/asignaturas')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('jefatura', 'secretaria')
export class AsignaturasController {
  constructor(
    private readonly service: AsignaturasService,
    private readonly bloques: BloquesService,
  ) {}

  @Post()
  create(@Body() dto: CreateAsignaturaDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() q: QueryAsignaturaDto) {
    return this.service.findAll(q);
  }

  @Get(':codigo')
  findOne(@Param('codigo') codigo: string) {
    return this.service.findOne(codigo);
  }

  @Patch(':codigo')
  update(@Param('codigo') codigo: string, @Body() dto: UpdateAsignaturaDto) {
    return this.service.update(codigo, dto);
  }

  @Delete(':codigo')
  remove(@Param('codigo') codigo: string) {
    return this.service.remove(codigo);
  }

  // ---------- Bloques de asignaturas EXTERNAS (ADM-F02-T3) ----------
  @Post(':codigo/bloques-externos')
  agregarBloquesExternos(
    @Param('codigo') codigo: string,
    @Body() dto: CreateBloquesExternosDto,
  ) {
    return this.bloques.agregarExternos(codigo, dto.bloques);
  }

  @Delete(':codigo/bloques-externos/:idBloque')
  eliminarBloqueExterno(
    @Param('codigo') codigo: string,
    @Param('idBloque', ParseIntPipe) idBloque: number,
  ) {
    return this.bloques.eliminarExterno(codigo, idBloque);
  }
}
