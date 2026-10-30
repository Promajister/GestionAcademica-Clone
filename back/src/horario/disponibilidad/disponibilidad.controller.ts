import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { JwtAccessPayload } from '../../auth/types/jwt-payload';
import { DisponibilidadService } from './disponibilidad.service';
import { GuardarDisponibilidadDto } from './dto/guardar-disponibilidad.dto';

// DIS-F02: el docente solo ve y edita SU disponibilidad.
// El id del usuario se toma siempre del JWT,
// y el servicio valida que tenga registro de Profesor y contrato habilitado.
@Controller('horario/disponibilidad')
@UseGuards(JwtCookieAuthGuard)
export class DisponibilidadController {
  constructor(private readonly service: DisponibilidadService) {}

  @Get('mia')
  obtenerMia(@Req() req: { user: JwtAccessPayload }) {
    return this.service.obtenerPropia(Number(req.user.sub));
  }

  @Put('mia')
  guardarMia(
    @Req() req: { user: JwtAccessPayload },
    @Body() dto: GuardarDisponibilidadDto,
  ) {
    return this.service.guardarPropia(Number(req.user.sub), dto);
  }
}
