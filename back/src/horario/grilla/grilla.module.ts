import { Module } from '@nestjs/common';
import { GrillaController } from './grilla.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GrillaController],
})
export class GrillaModule {}
