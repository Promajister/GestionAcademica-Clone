import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { EstudianteService } from './estudiante.service';
import { QueryEstudianteDto } from './dto/query-estudiante.dto';
import { UpdateEgresadoDto } from './dto/update-egresado.dto';
import { UpdateEmpleabilidadDto } from './dto/update-empleabilidad.dto';
import { JwtCookieAuthGuard } from '../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Controller('estudiante')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('vinculacion', 'practicas', 'jefatura')
export class EstudianteController {
  constructor(private readonly service: EstudianteService) {}

  @Get()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  findAll(@Query() q: QueryEstudianteDto) {
    return this.service.findAll(q);
  }

  @Get(':rut')
  findOne(@Param('rut') rut: string) {
    return this.service.findOne(rut);
  }

  @Patch(':rut/egresado')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  updateEgresado(@Param('rut') rut: string, @Body() body: UpdateEgresadoDto) {
    return this.service.updateEgresado(rut, body.egresado);
  }

  @Put(':rut/empleabilidad')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  upsertEmpleabilidad(@Param('rut') rut: string, @Body() body: UpdateEmpleabilidadDto) {
    return this.service.upsertEmpleabilidad(rut, body);
  }

  @Post('import')
  @Roles('jefatura')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        const isXlsx =
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.originalname.toLowerCase().endsWith('.xlsx');
        if (!isXlsx) {
          return cb(new BadRequestException('Solo se permiten archivos .xlsx'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importEstudiantes(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo .xlsx');
    }
    return this.service.importFromXlsx(file);
  }
}
