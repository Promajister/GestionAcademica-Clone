import { Controller, Get, UseGuards } from '@nestjs/common';
import { ActividadVinculacionService } from './actividad-vinculacion.service';
import { JwtCookieAuthGuard } from '../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('actividad-vinculacion')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('vinculacion', 'jefatura')
export class ActividadVinculacionController {
  constructor(private readonly service: ActividadVinculacionService) {}

  @Get('listado')
  listarParaSelect() {
    return this.service.listarParaSelect();
  }
}
