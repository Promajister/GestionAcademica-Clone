import { Module } from '@nestjs/common';
import { ProfesoresController } from './profesores.controller';
import { ProfesoresService } from './profesores.service';

@Module({
  controllers: [ProfesoresController],
  providers: [ProfesoresService],
  exports: [ProfesoresService],
})
export class ProfesoresModule {}
