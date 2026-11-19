import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CsrfGuard } from '../../auth/guards/csrf.guard';
import { PropuestaService } from './propuesta.service';
import { PeriodoDto } from './dto/periodo.dto';

// GEN-F01, F03 y F04: propuesta de horario del semestre, cruces y cierre
@Controller('horario/propuesta')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('jefatura', 'secretaria')
export class PropuestaController {
  constructor(private readonly service: PropuestaService) {}

  // GET /api/horario/propuesta?year=2026&periodo=2
  @Get()
  obtener(@Query() q: PeriodoDto) {
    return this.service.obtener(q.year, q.periodo);
  }

  // POST /api/horario/propuesta/generar { year, periodo }
  @Post('generar')
  @UseGuards(CsrfGuard)
  generar(@Body() dto: PeriodoDto) {
    return this.service.generar(dto.year, dto.periodo);
  }

  // GET /api/horario/propuesta/validacion?year=2026&periodo=2 (GEN-F03)
  @Get('validacion')
  validar(@Query() q: PeriodoDto) {
    return this.service.validar(q.year, q.periodo);
  }

  // POST /api/horario/propuesta/cerrar { year, periodo }: rechazado si hay cruces
  @Post('cerrar')
  @UseGuards(CsrfGuard)
  cerrar(@Body() dto: PeriodoDto) {
    return this.service.cerrar(dto.year, dto.periodo);
  }

  // POST /api/horario/propuesta/reabrir { year, periodo }: vuelve a borrador
  @Post('reabrir')
  @UseGuards(CsrfGuard)
  reabrir(@Body() dto: PeriodoDto) {
    return this.service.reabrir(dto.year, dto.periodo);
  }
}
