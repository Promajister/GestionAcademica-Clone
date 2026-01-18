import { Body, Controller, Get, Post, Param, BadRequestException, Patch } from '@nestjs/common';
import { EncuestasJefaturaService } from './encuestas-jefatura.service';

@Controller('encuestas-jefatura')
export class EncuestasJefaturaController {
  constructor(private readonly encuestasJefaturaService: EncuestasJefaturaService) {}

  @Get()
  async findAll() {
    return this.encuestasJefaturaService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') idParam: string) {
    const id = Number(idParam);
    if (Number.isNaN(id)) {
      throw new BadRequestException('ID invalido');
    }
    return this.encuestasJefaturaService.findOne(id);
  }

  @Post()
  async create(@Body() payload: any) {
    return this.encuestasJefaturaService.create(payload);
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
    return this.encuestasJefaturaService.actualizarRespuestasAbiertas(id, body);
  }
}
