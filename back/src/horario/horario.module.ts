import { Module } from '@nestjs/common';
import { SalasModule } from './salas/salas.module';

// Agrupa los submódulos de Horario para registrarlos una sola vez en AppModule
@Module({
  imports: [SalasModule],
})
export class HorarioModule {}
