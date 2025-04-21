import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtClienteStrategy extends PassportStrategy(
  Strategy,
  'jwt-cliente',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET_CLIENTE'),
    });
  }

  async validate(payload: any) {
    return { sub: payload.sub, role: payload.role };
  }
}

@Injectable()
export class JwtPrestadorStrategy extends PassportStrategy(
  Strategy,
  'jwt-prestador',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET_PRESTADOR'),
    });
  }

  async validate(payload: any) {
    return { sub: payload.sub, role: payload.role };
  }
}
