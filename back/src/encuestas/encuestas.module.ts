// Módulo de NestJS que agrupa controlador, servicio y Prisma para encuestas
import { Module } from '@nestjs/common';
import { EncuestasController } from './encuestas.controller';
import { EncuestasService } from './encuestas.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [],
  controllers: [EncuestasController],
  providers: [EncuestasService, PrismaService],
  exports: [EncuestasService],
})
export class EncuestasModule {}
