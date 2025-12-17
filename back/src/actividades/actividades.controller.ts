import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ActividadesService, ActividadCarrera, type PagedResult } from './actividades.service';
import { QueryActividadesDto } from './dto/query-actividades.dto';
import { JwtCookieAuthGuard } from '../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('actividades')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('practicas', 'jefatura')
export class ActividadesController {
  constructor(private readonly service: ActividadesService) {}

  @Get()
  list(@Query() query: QueryActividadesDto): PagedResult<ActividadCarrera> {
    return this.service.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.service.findById(id);
  }
}
