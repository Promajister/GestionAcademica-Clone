import { Module } from '@nestjs/common';
import { ActividadEgresadosController } from './actividad-egresados.controller';
import { ActividadEgresadosService } from './actividad-egresados.service';
import { PrismaModule } from 'prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MulterModule.register({
      dest: './uploads/actividades-egresados',
    }),
  ],
  controllers: [ActividadEgresadosController],
  providers: [ActividadEgresadosService],
})
export class ActividadEgresadosModule {}
