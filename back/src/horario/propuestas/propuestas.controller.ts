import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PropuestasService } from './propuestas.service';
import { PlanPeriodoDto } from './dto/plan-periodo.dto';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CsrfGuard } from '../../auth/guards/csrf.guard';

// HU "Generar propuesta de horario": generar (borrador), guardar (propuesta) y descartar
@Controller('horario/propuestas')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('jefatura', 'secretaria')
export class PropuestasController {
  constructor(private readonly service: PropuestasService) {}

  // GET /api/horario/propuestas?id_plan=2&periodo=2
  @Get()
  obtener(@Query() q: PlanPeriodoDto) {
    return this.service.obtener(q);
  }

  // POST /api/horario/propuestas/generar  { id_plan, periodo }
  @Post('generar')
  @UseGuards(CsrfGuard)
  generar(@Body() dto: PlanPeriodoDto) {
    return this.service.generar(dto);
  }

  // POST /api/horario/propuestas/guardar  { id_plan, periodo }
  @Post('guardar')
  @UseGuards(CsrfGuard)
  guardar(@Body() dto: PlanPeriodoDto) {
    return this.service.guardar(dto);
  }

  // DELETE /api/horario/propuestas?id_plan=2&periodo=2
  @Delete()
  @UseGuards(CsrfGuard)
  descartar(@Query() q: PlanPeriodoDto) {
    return this.service.descartar(q);
  }
}
