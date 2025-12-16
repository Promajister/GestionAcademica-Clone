import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';

import { HistorialService } from './historial.service';
import { HistorialQueryDto } from './dto/historial-query.dto';

@Controller('estudiantes')
export class HistorialController {
  constructor(private readonly service: HistorialService) {}

  @Get(':rut/historial')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  listar(@Param('rut') rut: string, @Query() q: HistorialQueryDto) {
    return this.service.list(rut, q);
  }

  @Get(':rut/historial/export')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async exportar(
    @Param('rut') rut: string,
    @Query() q: HistorialQueryDto,
    @Res() res: Response,
  ) {
    if ((q.format ?? 'pdf') !== 'pdf') {
      throw new BadRequestException('Solo se soporta format=pdf');
    }
    const pdf = await this.service.exportPdf(rut, q);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="historial-${rut}.pdf"`,
    );
    res.setHeader('Content-Length', pdf.length.toString());
    res.end(pdf);
  }
}
