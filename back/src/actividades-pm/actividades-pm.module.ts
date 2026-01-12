import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from 'prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ActividadesPmController } from './actividades-pm.controller';
import { ActividadesPmService } from './actividades-pm.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MulterModule.register({
      dest: './uploads/actividades-pm',
    }),
  ],
  controllers: [ActividadesPmController],
  providers: [ActividadesPmService],
})
export class ActividadesPmModule {}
