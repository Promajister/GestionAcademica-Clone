import { Module } from '@nestjs/common';
import { EncuestasEgresadosController } from './encuestas-egresados.controller';
import { EncuestasEgresadosService } from './encuestas-egresados.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [EncuestasEgresadosController],
  providers: [EncuestasEgresadosService, PrismaService],
})
export class EncuestasEgresadosModule {}
