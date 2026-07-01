import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '@anura/shared';
import type { AppConfig } from '../../config/configuration';

/**
 * Validates access tokens on protected routes. Passport attaches the returned
 * value to `req.user`, which `@CurrentUser()` reads. The token payload already
 * carries {sub,email,role,lawyerId}, so we simply echo it back.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const jwt = config.get<AppConfig['jwt']>('jwt')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwt.accessSecret,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      lawyerId: payload.lawyerId ?? null,
    };
  }
}
