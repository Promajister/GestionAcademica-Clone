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
    return this.reportes.getSatisfaccion({
      anio: Number(anio),
      semestre: Number(semestre) as 1 | 2,
      tipo: tipo ?? null,
    });
  }

  @Get('estudiante/:rut')
  getReporteEstudiante(@Param('rut') rut: string) {
    return this.reportes.getReporteEstudiante(rut);
  }

  // ✅ NUEVO: listado paginado server-side + búsqueda unificada
  @Get('estudiantes')
  listarEstudiantes(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('orderBy') orderBy?: 'nombre' | 'rut',
    @Query('orderDir') orderDir?: 'asc' | 'desc',
  ) {
    return this.reportes.listarEstudiantes({
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      orderBy: orderBy ?? 'nombre',
      orderDir: orderDir ?? 'asc',
    });
  }

  // ⛔ lo dejamos por compatibilidad si lo usas en otra vista
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
