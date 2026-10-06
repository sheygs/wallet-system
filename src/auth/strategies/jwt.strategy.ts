import 'dotenv/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { isUUID } from 'class-validator';
import { jwtPolicy } from '../jwt-policy';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
      issuer: jwtPolicy().issuer,
      audience: jwtPolicy().audience,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: unknown): Promise<{
    userId: string;
    isAdmin: boolean;
  }> {
    if (typeof payload !== 'object' || payload === null)
      throw new UnauthorizedException();

    const claims = payload as Record<string, unknown>;

    if (
      typeof claims.userId !== 'string' ||
      !isUUID(claims.userId) ||
      !Number.isSafeInteger(claims.exp) ||
      Number(claims.exp) <= Math.floor(Date.now() / 1000) ||
      !Number.isSafeInteger(claims.authVersion) ||
      Number(claims.authVersion) < 0
    )
      throw new UnauthorizedException();

    const authUser = await this.userService.getUserById(claims.userId);

    if (!authUser || authUser.auth_version !== claims.authVersion) {
      throw new UnauthorizedException('Unauthorized User');
    }

    return {
      userId: authUser.id,
      ...(authUser.email && { email: authUser.email }),
      ...(authUser.phone_number && { phoneNumber: authUser.phone_number }),
      isAdmin: authUser.is_admin === true,
    };
  }
}
