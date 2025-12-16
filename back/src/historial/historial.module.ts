import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { HistorialService } from './historial.service';
import { HistorialController } from './historial.controller';

@Module({
  imports: [PrismaModule],
  controllers: [HistorialController],
  providers: [HistorialService],
  exports: [HistorialService],
})
export class HistorialModule {}
