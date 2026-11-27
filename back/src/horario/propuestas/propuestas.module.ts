import { Module } from '@nestjs/common';
import { PropuestasController } from './propuestas.controller';
import { PropuestasService } from './propuestas.service';

@Module({
  controllers: [PropuestasController],
  providers: [PropuestasService],
})
export class PropuestasModule {}
