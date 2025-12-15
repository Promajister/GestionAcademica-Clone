import { Controller, Get, Param, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { EstudianteService } from './estudiante.service';
import { QueryEstudianteDto } from './dto/query-estudiante.dto';
import { JwtCookieAuthGuard } from '../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('estudiante')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('vinculacion', 'practicas', 'jefatura')
export class EstudianteController {
  constructor(private readonly service: EstudianteService) {}

  @Get()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  findAll(@Query() q: QueryEstudianteDto) {
    return this.service.findAll(q);
  }

  @Get(':rut')
  findOne(@Param('rut') rut: string) {
    return this.service.findOne(rut);
  }
}
