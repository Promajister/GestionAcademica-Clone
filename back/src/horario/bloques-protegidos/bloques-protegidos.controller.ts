import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BloquesProtegidosService } from './bloques-protegidos.service';
import { CreateBloqueProtegidoDto } from './dto/create-bloque-protegido.dto';
import { UpdateBloqueProtegidoDto } from './dto/update-bloque-protegido.dto';
import { QueryBloqueProtegidoDto } from './dto/query-bloque-protegido.dto';
import { QueryAplicablesDto } from './dto/query-aplicables.dto';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

// Sin @Roles por ahora: los perfiles del módulo Horario se definen en ADM-F04
@Controller('horario/bloques-protegidos')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('jefatura')
export class BloquesProtegidosController {
  constructor(private readonly service: BloquesProtegidosService) {}

  @Get('profesores')
  listProfesores() {
    return this.service.listProfesores();
  }

  @Get('aplicables')
  findAplicables(@Query() q: QueryAplicablesDto) {
    return this.service.findAplicables(q);
  }

  @Get()
  findAll(@Query() q: QueryBloqueProtegidoDto) {
    return this.service.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBloqueProtegidoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBloqueProtegidoDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('grupo') grupo?: string,
  ) {
    const esGrupo = grupo === 'true' || grupo === '1';
    return this.service.remove(id, esGrupo);
  }
}
