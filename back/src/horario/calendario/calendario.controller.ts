import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { CalendarioService } from './calendario.service';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('horario/calendario')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('jefatura', 'secretaria')
export class CalendarioController {
  constructor(private readonly calendarioService: CalendarioService) {}

  // GET /api/horario/calendario/ocupacion-semanal?semestre=2&year=2026
  @Get('ocupacion-semanal')
  getOcupacionSemanal(
    @Query('semestre', ParseIntPipe) semestre: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return this.calendarioService.obtenerOcupacionDepartamento(semestre, year);
  }
}
