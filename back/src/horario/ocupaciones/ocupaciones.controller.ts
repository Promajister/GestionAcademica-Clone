import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OcupacionesService } from './ocupaciones.service';
import { CreateOcupacionDto } from './dto/create-ocupacion.dto';
import { QueryOcupacionDto } from './dto/query-ocupacion.dto';
import { JwtCookieAuthGuard } from '../../auth/guards/jwt-cookie-auth.guard';
import { JwtAccessPayload } from '../../auth/types/jwt-payload';

// Sin @Roles por ahora: los perfiles del módulo Horario se definen en ADM-F04
@Controller('horario/ocupaciones')
@UseGuards(JwtCookieAuthGuard)
export class OcupacionesController {
  constructor(private readonly service: OcupacionesService) {}

  @Post()
  create(@Body() dto: CreateOcupacionDto, @Req() req: Request) {
    const usuario = req.user as JwtAccessPayload;
    return this.service.create(dto, usuario.sub);
  }

  @Get()
  findAll(@Query() q: QueryOcupacionDto) {
    return this.service.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
