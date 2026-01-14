import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ActividadesPmService } from './actividades-pm.service';
import { JwtCookieAuthGuard } from '../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const allowedByField: Record<string, string[]> = {
  asistencia: ['.pdf', '.xls', '.xlsx'],
  documentos: ['.pdf', '.xls', '.xlsx'],
  fotos: ['.jpg', '.jpeg', '.png'],
};

@Controller('actividades-pm')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('vinculacion', 'jefatura')
export class ActividadesPmController {
  constructor(private readonly service: ActividadesPmService) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'asistencia', maxCount: 1 },
        { name: 'documentos', maxCount: 1 },
        { name: 'fotos', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads/actividades-pm',
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            cb(null, `actividad-pm-${file.fieldname}-${uniqueSuffix}${ext}`);
          },
        }),
        fileFilter: (req, file, cb) => {
          const extension = extname(file.originalname).toLowerCase();
          const allowed = allowedByField[file.fieldname] ?? [];

          if (!allowed.includes(extension)) {
            return cb(
              new BadRequestException('Tipo de archivo no permitido'),
              false,
            );
          }

          cb(null, true);
        },
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  create(
    @UploadedFiles()
    files: {
      asistencia?: Express.Multer.File[];
      documentos?: Express.Multer.File[];
      fotos?: Express.Multer.File[];
    },
    @Body('data') data: string,
  ) {
    if (!data) throw new BadRequestException('Falta data');

    let payload: any;
    try {
      payload = JSON.parse(data);
    } catch {
      throw new BadRequestException('JSON invalido');
    }

    return this.service.create(payload, files);
  }

  @Get()
  findAll(
    @Query('anio') anio?: string,
    @Query('tipo') tipo?: string,
    @Query('q') q?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaTermino') fechaTermino?: string,
  ) {
    return this.service.findAll({ anio, tipo, q, fechaInicio, fechaTermino });
  }

  @Get('unidades/:codigo')
  async findUnidad(@Param('codigo') codigo: string) {
    const unidad = await this.service.findUnidadByCodigo(codigo);
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    return unidad;
  }

  @Get('responsables/:rut')
  async findResponsable(@Param('rut') rut: string) {
    const responsable = await this.service.findResponsableByRut(rut);
    if (!responsable) throw new NotFoundException('Responsable no encontrado');
    return responsable;
  }

  @Get('equipo-trabajo/:rut')
  async findEquipoTrabajo(@Param('rut') rut: string) {
    const equipo = await this.service.findEquipoTrabajoByRut(rut);
    if (!equipo) throw new NotFoundException('Equipo de trabajo no encontrado');
    return equipo;
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post(':id/resumen-ia')
  regenerarResumen(@Param('id', ParseIntPipe) id: number) {
    return this.service.regenerarResumen(id);
  }

  @Put(':id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'asistencia', maxCount: 1 },
        { name: 'documentos', maxCount: 1 },
        { name: 'fotos', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads/actividades-pm',
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            cb(null, `actividad-pm-${file.fieldname}-${uniqueSuffix}${ext}`);
          },
        }),
        fileFilter: (req, file, cb) => {
          const extension = extname(file.originalname).toLowerCase();
          const allowed = allowedByField[file.fieldname] ?? [];

          if (!allowed.includes(extension)) {
            return cb(
              new BadRequestException('Tipo de archivo no permitido'),
              false,
            );
          }

          cb(null, true);
        },
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles()
    files: {
      asistencia?: Express.Multer.File[];
      documentos?: Express.Multer.File[];
      fotos?: Express.Multer.File[];
    },
    @Body('data') data: string,
  ) {
    if (!data) throw new BadRequestException('Falta data');

    let payload: any;
    try {
      payload = JSON.parse(data);
    } catch {
      throw new BadRequestException('JSON invalido');
    }

    return this.service.update(id, payload, files);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
