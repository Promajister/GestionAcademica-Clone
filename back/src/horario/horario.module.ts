import { Module } from '@nestjs/common';
import { SalasModule } from './salas/salas.module';
import { CarrerasModule } from './carreras/carreras.module';
import { AsignaturasModule } from './asignaturas/asignaturas.module';
import { BloquesModule } from './bloques/bloques.module';
import { GrillaModule } from './grilla/grilla.module';
import { OcupacionesModule } from './ocupaciones/ocupaciones.module';
import { BloquesProtegidosModule } from './bloques-protegidos/bloques-protegidos.module';

// Agrupa los submódulos de Horario para registrarlos una sola vez en AppModule
@Module({
  imports: [
    SalasModule,
    CarrerasModule,
    AsignaturasModule,
    BloquesModule,
    GrillaModule,
    OcupacionesModule,
    BloquesProtegidosModule,
  ],
})
export class HorarioModule {}
