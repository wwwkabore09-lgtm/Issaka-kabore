import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET', 'change-me'),
    });
  }

  // Le retour devient req.user. On ne garde que l'id : chaque domaine recharge le reste
  // depuis la base si besoin, plutôt que de faire confiance à un JWT potentiellement ancien.
  validate(payload: JwtPayload): { userId: string } {
    return { userId: payload.sub };
  }
}
