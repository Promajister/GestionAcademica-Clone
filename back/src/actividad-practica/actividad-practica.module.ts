import { Module } from '@nestjs/common';
import { ActividadPracticaController } from './actividad-practica.controller';
import { ActividadPracticaService } from './actividad-practica.service';
import { PrismaModule } from 'prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MulterModule.register({
      dest: './uploads/actividades', 
    }),
  ],
  controllers: [ActividadPracticaController],
  providers: [ActividadPracticaService],
})
export class ActividadPracticaModule {}
