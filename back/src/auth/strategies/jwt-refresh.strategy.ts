import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { StrategyOptionsWithRequest } from 'passport-jwt';
import { JwtRefreshPayload } from '../types/jwt-payload';

const refreshExtractor = (req: any): string | null => req?.cookies?.refresh_token || null;

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new Error('JWT_REFRESH_SECRET env var not set');

    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([refreshExtractor]),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    };

    super(options);
  }

  validate(req: any, payload: JwtRefreshPayload) {
    const token = req?.cookies?.refresh_token;
    return { ...payload, refreshToken: token };
  }
}
