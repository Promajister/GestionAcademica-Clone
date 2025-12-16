import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { CartaService } from './carta.service';

@Controller()
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
