import { Module } from '@nestjs/common';
import { EstudianteController } from './estudiante.controller';
import { EstudiantesAliasController } from './estudiantes-alias.controller';
import { EstudianteService } from './estudiante.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EstudianteController, EstudiantesAliasController],
  providers: [EstudianteService],
  exports: [EstudianteService],
})
export class EstudianteModule {}
