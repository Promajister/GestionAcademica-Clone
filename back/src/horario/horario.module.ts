import { Module } from '@nestjs/common';
import { SalasModule } from './salas/salas.module';
import { CarrerasModule } from './carreras/carreras.module';
import { AsignaturasModule } from './asignaturas/asignaturas.module';
import { BloquesModule } from './bloques/bloques.module';

// Agrupa los submódulos de Horario para registrarlos una sola vez en AppModule
@Module({
  imports: [SalasModule, CarrerasModule, AsignaturasModule, BloquesModule],
})
export class HorarioModule {}
