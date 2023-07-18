import 'dotenv/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: {
    userId: string;
    isAdmin: boolean;
    email?: string;
    phoneNumber?: string;
  }): Promise<{
    userId: string;
    isAdmin: boolean;
  }> {
    const authUser = await this.userService.getUserById(payload.userId);

    if (!authUser) {
      throw new UnauthorizedException('Unauthorized User');
    }

    return {
      userId: payload.userId,
      ...(payload.email && { email: payload.email }),
      ...(payload.phoneNumber && { phoneNumber: payload.phoneNumber }),
      isAdmin: payload.isAdmin,
    };
  }
}
