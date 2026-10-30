import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CargaDocenteService } from './carga-docente.service';
import { AsignarCargaDto } from './dto/create-carga.dto';
import { QueryCursosDto } from './dto/query-cursos.dto';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CsrfGuard } from '../../auth/guards/csrf.guard';

// ADM-F03: asignación de profesores y carga a las asignaturas propias
@Controller('horario/carga-docente')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('jefatura', 'secretaria')
export class CargaDocenteController {
  constructor(private readonly cargaDocenteService: CargaDocenteService) {}

  // GET /api/horario/carga-docente/profesores
  @Get('profesores')
  getProfesores() {
    return this.cargaDocenteService.obtenerProfesoresParaAsignacion();
  }

  // GET /api/horario/carga-docente/cursos?semestre=2&year=2026
  @Get('cursos')
  getCursos(@Query() q: QueryCursosDto) {
    return this.cargaDocenteService.obtenerCursosConEstadoPendiente(
      q.semestre,
      q.year,
    );
  }

  // POST /api/horario/carga-docente/asignar
  @Post('asignar')
  @UseGuards(CsrfGuard)
  asignarCargas(@Body() dto: AsignarCargaDto) {
    return this.cargaDocenteService.asignarCarga(dto);
  }

  // DELETE /api/horario/carga-docente/eliminar/:id_curso/:id_usuario
  @Delete('eliminar/:id_curso/:id_usuario')
  @UseGuards(CsrfGuard)
  eliminarCarga(
    @Param('id_curso', ParseIntPipe) id_curso: number,
    @Param('id_usuario', ParseIntPipe) id_usuario: number,
  ) {
    return this.cargaDocenteService.eliminarCarga(id_curso, id_usuario);
  }
}
