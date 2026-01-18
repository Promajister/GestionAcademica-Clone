import { Module } from '@nestjs/common';
import { EncuestasJefaturaController } from './encuestas-jefatura.controller';
import { EncuestasJefaturaService } from './encuestas-jefatura.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [EncuestasJefaturaController],
  providers: [EncuestasJefaturaService, PrismaService],
  exports: [EncuestasJefaturaService],
})
export class EncuestasJefaturaModule {}
