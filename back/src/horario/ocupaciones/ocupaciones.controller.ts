import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OcupacionesService } from './ocupaciones.service';
import { CreateOcupacionDto } from './dto/create-ocupacion.dto';
import { QueryOcupacionDto } from './dto/query-ocupacion.dto';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

// Sin @Roles por ahora: los perfiles del módulo Horario se definen en ADM-F04
@Controller('horario/ocupaciones')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('jefatura', 'secretaria')
export class OcupacionesController {
  constructor(private readonly service: OcupacionesService) {}

  @Post()
  create(@Body() dto: CreateOcupacionDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() q: QueryOcupacionDto) {
    return this.service.findAll(q);
  }

  @Delete(':idSala/:idBloque/:fecha')
  remove(
    @Param('idSala', ParseIntPipe) idSala: number,
    @Param('idBloque', ParseIntPipe) idBloque: number,
    @Param('fecha') fecha: string,
  ) {
    return this.service.remove(idSala, idBloque, fecha);
  }
}
