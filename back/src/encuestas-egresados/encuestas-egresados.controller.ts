import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { EncuestasEgresadosService } from './encuestas-egresados.service';

@Controller('encuestas-egresados')
export class EncuestasEgresadosController {
  constructor(private readonly encuestasEgresadosService: EncuestasEgresadosService) {}

  @Get()
  async findAll() {
    return this.encuestasEgresadosService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') idParam: string) {
    const id = Number(idParam);
    if (Number.isNaN(id)) {
      throw new BadRequestException('ID invalido');
    }
    return this.encuestasEgresadosService.findOne(id);
  }

  @Post()
  async create(@Body() payload: any) {
    return this.encuestasEgresadosService.create(payload);
  }

  @Patch(':id/abiertas')
  async actualizarAbiertas(
    @Param('id') idParam: string,
    @Body() body: { respuestas: { preguntaId: number; respuestaAbierta: string }[] },
  ) {
    const id = Number(idParam);
    if (Number.isNaN(id)) {
      throw new BadRequestException('ID invalido');
    }
    return this.encuestasEgresadosService.actualizarRespuestasAbiertas(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') idParam: string) {
    const id = Number(idParam);
    if (Number.isNaN(id)) {
      throw new BadRequestException('ID invalido');
    }
    return this.encuestasEgresadosService.remove(id);
  }
}
