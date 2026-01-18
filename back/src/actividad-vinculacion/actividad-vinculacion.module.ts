import { Module } from '@nestjs/common';
import { ActividadVinculacionController } from './actividad-vinculacion.controller';
import { ActividadVinculacionService } from './actividad-vinculacion.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [ActividadVinculacionController],
  providers: [ActividadVinculacionService, PrismaService],
  exports: [ActividadVinculacionService],
})
export class ActividadVinculacionModule {}
