import { Module } from '@nestjs/common';
import { PracticasController } from './practicas.controller';
import { PracticasService } from './practicas.service';
import { ObservacionesController } from './observaciones.controller';
import { ObservacionesService } from './observaciones.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PracticasController, ObservacionesController],
  providers: [PracticasService, ObservacionesService]
})
export class PracticasModule {}
