import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BloquesService } from './bloques.service';
import { QueryBloqueDto } from './dto/query-bloque.dto';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';

// Sin @Roles por ahora: los perfiles del módulo Horario se definen en ADM-F04
@Controller('horario/bloques')
@UseGuards(JwtCookieAuthGuard)
export class BloquesController {
  constructor(private readonly service: BloquesService) {}

  @Get()
  findAll(@Query() q: QueryBloqueDto) {
    return this.service.findAll(q);
  }
}
