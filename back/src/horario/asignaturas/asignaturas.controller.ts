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
import { AsignaturasService } from './asignaturas.service';
import { CreateAsignaturaDto } from './dto/create-asignatura.dto';
import { UpdateAsignaturaDto } from './dto/update-asignatura.dto';
import { QueryAsignaturaDto } from './dto/query-asignatura.dto';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';

// Sin @Roles por ahora: los perfiles del módulo Horario se definen en ADM-F04
@Controller('horario/asignaturas')
@UseGuards(JwtCookieAuthGuard)
export class AsignaturasController {
  constructor(private readonly service: AsignaturasService) {}

  @Post()
  create(@Body() dto: CreateAsignaturaDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() q: QueryAsignaturaDto) {
    return this.service.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAsignaturaDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
