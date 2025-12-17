import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtCookieAuthGuard } from './guards/jwt-cookie-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.register({}),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    JwtCookieAuthGuard,
    JwtRefreshGuard,
    CsrfGuard,
    RolesGuard,
    RefreshTokenRepository,
  ],
  exports: [JwtCookieAuthGuard, RolesGuard],
})
export class AuthModule {}
