import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { EstudianteService } from './estudiante.service';
import { QueryEstudianteDto } from './dto/query-estudiante.dto';
import { Param } from '@nestjs/common';
import { JwtCookieAuthGuard } from '../auth/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Controller('estudiantes')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('vinculacion', 'practicas', 'jefatura')
export class EstudiantesAliasController {
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
