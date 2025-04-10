import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'ewfj/DwBZAe0Z7IVho8zrn89HN9VI7nVTzVK9/JIlAY=', // Substitua pela sua chave secreta
    });
  }

  async validate(payload: any) {
    return { id_cliente: payload.sub, email: payload.email };
  }
}
