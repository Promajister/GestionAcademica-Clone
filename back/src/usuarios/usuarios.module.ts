import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { JefaturaGuard } from './usuarios.guard';

@Module({
  imports: [PrismaModule],
  controllers: [UsuariosController],
  providers: [UsuariosService, JefaturaGuard],
})
export class UsuariosModule {}
