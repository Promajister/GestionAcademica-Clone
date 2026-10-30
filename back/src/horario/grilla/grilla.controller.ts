import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { BLOQUES_PEDAGOGICOS } from '../common/grilla';

// Solo los horarios de los bloques: la usan jefatura y "Mi disponibilidad" del profesor
@Controller('horario/grilla')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('jefatura', 'profesor')
export class GrillaController {
  // Bloques de 45 min para que el front dibuje la grilla semanal
  @Get()
  findAll() {
    return BLOQUES_PEDAGOGICOS;
  }
}
