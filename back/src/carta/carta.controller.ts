import { Controller, Get, Query, Post, Body, UseGuards } from '@nestjs/common';
import { CartaService } from './carta.service';
import { JwtCookieAuthGuard } from '../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// Las rutas quedan bajo /api/* gracias al prefijo global. No repetir "api" aquí.
@Controller()
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('jefatura')
export class CartaController {
  constructor(private readonly svc: CartaService) {}

  @Get('practicas/tipos')
  getTiposPractica() {
    return this.svc.getTiposPractica();
  }

  @Get('centros')
  getCentros(@Query('q') q?: string) {
    return this.svc.getCentros(q);
  }

  @Get('estudiantes')
  getEstudiantes(@Query('q') q?: string) {
    return this.svc.getEstudiantes(q);
  }

  @Get('supervisores')
  getSupervisores(@Query('q') q?: string) {
    return this.svc.getSupervisores(q);
  }

  @Post('cartas')
  crearCarta(@Body() dto: any) {
    return this.svc.crearCarta(dto);
  }
}
