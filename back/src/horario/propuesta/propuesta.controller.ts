import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CsrfGuard } from '../../auth/guards/csrf.guard';
import { PropuestaService } from './propuesta.service';
import { PeriodoDto } from './dto/periodo.dto';
import { MoverBloqueDto } from './dto/mover-bloque.dto';

// GEN-F01 a F04: propuesta de horario del semestre, arrastre, cruces y cierre
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

  // PATCH /api/horario/propuesta/mover: mueve una clase y revalida el horario (GEN-F02)
  @Patch('mover')
  @UseGuards(CsrfGuard)
  mover(@Body() dto: MoverBloqueDto) {
    return this.service.mover(dto);
  }

  // POST /api/horario/propuesta/deshacer { year, periodo }: deshace el último movimiento
  @Post('deshacer')
  @UseGuards(CsrfGuard)
  deshacer(@Body() dto: PeriodoDto) {
    return this.service.deshacer(dto.year, dto.periodo);
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
