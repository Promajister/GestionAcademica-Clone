import { Module } from '@nestjs/common';
import { BloquesProtegidosController } from './bloques-protegidos.controller';
import { BloquesProtegidosService } from './bloques-protegidos.service';

@Module({
  controllers: [BloquesProtegidosController],
  providers: [BloquesProtegidosService],
  exports: [BloquesProtegidosService],
})
export class BloquesProtegidosModule {}
