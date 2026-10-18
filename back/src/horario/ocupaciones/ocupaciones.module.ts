import { Module } from '@nestjs/common';
import { OcupacionesService } from './ocupaciones.service';
import { OcupacionesController } from './ocupaciones.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OcupacionesController],
  providers: [OcupacionesService],
})
export class OcupacionesModule {}
