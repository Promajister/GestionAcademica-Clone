import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CargaDocenteService } from './carga-docente.service';
import { AsignarCargaDto } from './dto/create-carga.dto';
import { Delete, Param } from '@nestjs/common';

@Controller('carga-docente')
export class CargaDocenteController {
  constructor(private readonly cargaDocenteService: CargaDocenteService) {}

  @Get('profesores')
  getProfesores() {
    return this.cargaDocenteService.obtenerProfesoresParaAsignacion();
  }

  @Get('cursos')
  getCursos(@Query('semestre') semestre: string, @Query('year') year: string) {
    return this.cargaDocenteService.obtenerCursosConEstadoPendiente(+semestre, +year);
  }

  @Post('asignar')
  asignarCargas(@Body() dto: AsignarCargaDto) {
    return this.cargaDocenteService.asignarCarga(dto);
  }

  @Delete('eliminar/:id_curso/:id_usuario')
  eliminarCarga(@Param('id_curso') id_curso: string, @Param('id_usuario') id_usuario: string) {
    return this.cargaDocenteService.eliminarCarga(+id_curso, +id_usuario);
  }
  
}