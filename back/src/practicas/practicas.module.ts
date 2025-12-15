import { Module } from '@nestjs/common';
import { PracticasController } from './practicas.controller';
import { PracticasService } from './practicas.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PracticasController],
  providers: [PracticasService]
})
export class PracticasModule {}
