import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReportesService } from './reportes.service';

@Controller('api/reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('summary')
  getSummary() {
    return this.reportes.getSummary();
  }

  @Get('indicadores')
  getIndicadores() {
    return this.reportes.getIndicadores();
  }

  @Get('satisfaccion')
  getSatisfaccion(@Query('anio') anio: string) {
    return this.reportes.getReporteSatisfaccion(Number(anio));
  }

  @Get('estudiante/:rut')
  getReporteEstudiante(@Param('rut') rut: string) {
    return this.reportes.getReporteEstudiante(rut);
  }

  @Get('estudiantes/buscar')
  buscar(@Query('nombre') nombre: string) {
    return this.reportes.buscarEstudiantes(nombre);
  }

}
