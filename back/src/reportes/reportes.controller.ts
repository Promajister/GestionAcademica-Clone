import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReportesService } from './reportes.service';

@Controller('/reportes')
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
  getSatisfaccion(
    @Query('anio') anio: string,
    @Query('semestre') semestre: string,
    @Query('tipo') tipo?: string,
  ) {
    return this.reportes.getReporteSatisfaccion({
      anio: Number(anio),
      semestre: Number(semestre) as 1 | 2,
      tipo: tipo ?? null,
    });
  }

  @Get('estudiante/:rut')
  getReporteEstudiante(@Param('rut') rut: string) {
    return this.reportes.getReporteEstudiante(rut);
  }

  @Get('estudiantes/buscar')
  buscar(@Query('nombre') nombre: string) {
    return this.reportes.buscarEstudiantes(nombre);
  }

  @Get('historico')
  getHistorico(
    @Query('fromYear') fromYear: string,
    @Query('toYear') toYear: string,
    @Query('tipo') tipo?: string,
    @Query('groupBy') groupBy: 'semester' | 'year' = 'semester',
  ) {
    return this.reportes.getHistorico({
      fromYear: Number(fromYear),
      toYear: Number(toYear),
      tipo: tipo ?? null,
      groupBy,
    });
  }
}
