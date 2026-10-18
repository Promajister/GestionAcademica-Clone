import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { BLOQUES_PEDAGOGICOS } from '../common/grilla';

// Sin @Roles por ahora: los perfiles del módulo Horario se definen en ADM-F04
@Controller('horario/grilla')
@UseGuards(JwtCookieAuthGuard)
export class GrillaController {
  // Bloques de 45 min para que el front dibuje la grilla semanal
  @Get()
  findAll() {
    return BLOQUES_PEDAGOGICOS;
  }
}
