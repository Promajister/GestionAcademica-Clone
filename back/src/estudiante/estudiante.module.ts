import { Module } from '@nestjs/common';
import { EstudianteController } from './estudiante.controller';
import { EstudiantesAliasController } from './estudiantes-alias.controller';
import { EstudianteService } from './estudiante.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EstudianteController, EstudiantesAliasController],
  providers: [EstudianteService],
  exports: [EstudianteService],
})
export class EstudianteModule {}
