import { Module } from '@nestjs/common';
import { CartaController } from './carta.controller';
import { CartaService } from './carta.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CartaController],
  providers: [CartaService],
})
export class CartaModule {}
