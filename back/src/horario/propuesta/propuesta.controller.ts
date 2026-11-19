import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CsrfGuard } from '../../auth/guards/csrf.guard';
import { PropuestaService } from './propuesta.service';
import { PeriodoDto } from './dto/periodo.dto';

// GEN-F01: propuesta de horario del semestre
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
}
