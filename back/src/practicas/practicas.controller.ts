import { Body, Controller, Get, Param, ParseIntPipe, Post, Patch, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { PracticasService } from './practicas.service';
import { CreatePracticaDto } from './dto/crear-practica.dto';
import { ConsultasPracticasDto } from './dto/consultar-practicas-dto';
import { ConsultasJefaturaDto } from './dto/consultar-jefatura.dto';
import { ActualizarEstadoDto } from './dto/actualizar-estado.dto';
import { Sse } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { JwtCookieAuthGuard } from '../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';


@Controller('practicas')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('practicas', 'jefatura', 'vinculacion')
export class PracticasController {
  constructor(private readonly service: PracticasService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Body() dto: CreatePracticaDto) {
    //  - "Debe completar todos los campos requeridos." (desde el service)
    return this.service.create(dto);
  }

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async list(@Query() q: ConsultasPracticasDto) {
    return this.service.list(q);
  }

  // Panel jefatura 
  @Get('jefatura')
  @UsePipes(new ValidationPipe({ transform: true }))
  async listForJefatura(@Query() q: ConsultasJefaturaDto) {
    return this.service.listForJefatura(q);
  }

  @Patch(':id/estado')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEstadoDto,
  ) {
    return this.service.updateEstado(id, dto.estado);
  }
  
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
  
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.service.stream$.pipe(
        map((data) => ({ data }) as MessageEvent),
    );
    }

}
