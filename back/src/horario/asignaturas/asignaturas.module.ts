import { Module } from '@nestjs/common';
import { AsignaturasService } from './asignaturas.service';
import { AsignaturasController } from './asignaturas.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { BloquesModule } from '../bloques/bloques.module';

@Module({
  imports: [PrismaModule, AuthModule, BloquesModule],
  controllers: [AsignaturasController],
  providers: [AsignaturasService],
  exports: [AsignaturasService],
})
export class AsignaturasModule {}
