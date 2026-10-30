import { Controller, Get, UseGuards } from '@nestjs/common';
import { CarrerasService } from './carreras.service';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

// Sin @Roles por ahora: los perfiles del módulo Horario se definen en ADM-F04
@Controller('horario/carreras')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('jefatura', 'secretaria')
export class CarrerasController {
  constructor(private readonly service: CarrerasService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
