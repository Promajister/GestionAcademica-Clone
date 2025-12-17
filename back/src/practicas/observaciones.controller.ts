import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { ObservacionesService } from './observaciones.service';
import { CreateObservacionDto } from './dto/crear-observacion.dto';
import { UpdateObservacionDto } from './dto/actualizar-observacion.dto';

@Controller('practicas/:practicaId/observaciones')
export class ObservacionesController {
  constructor(private readonly service: ObservacionesService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(
    @Param('practicaId', ParseIntPipe) practicaId: number,
    @Body() dto: Omit<CreateObservacionDto, 'practicaId'>,
    @Headers('x-user-role') userRole?: string,
  ) {
    return this.service.create({ ...dto, practicaId }, userRole);
  }

  @Get()
  async findByPractica(@Param('practicaId', ParseIntPipe) practicaId: number) {
    return this.service.findByPractica(practicaId);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateObservacionDto,
    @Headers('x-user-role') userRole?: string,
  ) {
    return this.service.update(id, dto, userRole);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-role') userRole?: string,
  ) {
    return this.service.remove(id, userRole);
  }
}

