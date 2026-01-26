import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ActividadEgresadosService } from './actividad-egresados.service';
import { CreateActividadEgresadosDto } from './dto/crear-actividad-egresados.dto';
import { UpdateActividadEgresadosDto } from './dto/actualizar-actividad-egresados.dto';
import { QueryActividadEgresadosDto } from './dto/consulta-actividad-egresados.dto';
import { JwtCookieAuthGuard } from '../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('actividades-egresados')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('jefatura', 'vinculacion')
export class ActividadEgresadosController {
  constructor(private readonly service: ActividadEgresadosService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: './uploads/actividades-egresados',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `actividad-egresados-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const extension = extname(file.originalname).toLowerCase();
        const allowed = ['.pdf', '.png', '.zip'];

        if (!allowed.includes(extension)) {
          return cb(
            new BadRequestException('Solo se permiten archivos PDF, PNG o ZIP'),
            false,
          );
        }

        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  create(
    @UploadedFile() archivo: Express.Multer.File,
    @Body() dto: CreateActividadEgresadosDto,
  ) {
    const evidenciaUrl = archivo
      ? `uploads/actividades-egresados/${archivo.filename}`
      : dto.evidenciaUrl;

    const dtoConArchivo: CreateActividadEgresadosDto = {
      ...dto,
      evidenciaUrl,
    };

    return this.service.create(dtoConArchivo);
  }

  @Get()
  findAll(@Query() q: QueryActividadEgresadosDto) {
    return this.service.findAll(q);
  }

  @Get('terceros/:rut')
  findTerceroByRut(@Param('rut') rut: string) {
    return this.service.findTerceroByRut(rut);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: './uploads/actividades-egresados',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `actividad-egresados-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const extension = extname(file.originalname).toLowerCase();
        const allowed = ['.pdf', '.png', '.zip'];

        if (!allowed.includes(extension)) {
          return cb(
            new BadRequestException('Solo se permiten archivos PDF, PNG o ZIP'),
            false,
          );
        }

        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() archivo: Express.Multer.File,
    @Body() dto: UpdateActividadEgresadosDto,
  ) {
    const evidenciaUrl = archivo
      ? `uploads/actividades-egresados/${archivo.filename}`
      : dto.evidenciaUrl;

    const dtoConArchivo: UpdateActividadEgresadosDto = {
      ...dto,
      evidenciaUrl,
    };

    return this.service.update(id, dtoConArchivo);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
