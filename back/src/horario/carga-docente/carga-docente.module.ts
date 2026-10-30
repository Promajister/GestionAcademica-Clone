import { Module } from '@nestjs/common';
import { CargaDocenteController } from './carga-docente.controller';
import { CargaDocenteService } from './carga-docente.service';

@Module({
  controllers: [CargaDocenteController],
  providers: [CargaDocenteService],
})
export class CargaDocenteModule {}
