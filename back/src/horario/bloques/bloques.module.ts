import { Module } from '@nestjs/common';
import { BloquesService } from './bloques.service';
import { BloquesController } from './bloques.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BloquesController],
  providers: [BloquesService],
  exports: [BloquesService],
})
export class BloquesModule {}
