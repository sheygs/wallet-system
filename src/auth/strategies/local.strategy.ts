import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { LoginUserDTO } from '../../users/dtos/user.dto';
import { User } from '../../users/user.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(body: { email: string; password: string }): Promise<User> {
    const { email, password } = body;

    const user = await this.authService.validateUser(email, password);

    console.log({ user });

    //  if (!user) {
    //    throw new UnauthorizedException();
    //  }

    return user;
  }
}
