import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { HashService } from '../hash/hash.service';
import { CreateUserDTO } from '../users/dtos/user.dto';
import { User } from '../users/user.entity';
import { LoginUserDTO } from './dtos/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private hashService: HashService,
    private jwtService: JwtService,
  ) {}
  async signup(body: CreateUserDTO): Promise<User> {
    try {
      // Hash user password
      const hashPassword = await this.hashService.hashPassword(body?.password);

      body.password = hashPassword;

      const user = await this.usersService.createUser(body);

      return user;
    } catch (error) {
      if (error?.code === '23505') {
        throw new BadRequestException(
          'User with the email/phone number already exists',
        );
      }
    }
  }

  async validateUser(authPayload: LoginUserDTO): Promise<User> {
    const { email, phone_number, password } = authPayload;

    const user = await this.usersService.findUser(email, phone_number);

    if (!user) {
      throw new BadRequestException('Invalid email/phone number');
    }

    if (!(await this.hashService.comparePassword(password, user.password))) {
      throw new BadRequestException('Invalid password');
    }

    return user;
  }

  async login(authPayload: LoginUserDTO) {
    const user = await this.validateUser(authPayload);

    const payload = {
      userId: user.id,
      ...(user.email && { email: user.email }),
      ...(user.phone_number && { phoneNumber: user.phone_number }),
      isAdmin: user.is_admin,
    };

    return {
      id: user.id,
      ...(user.email && { email: user.email }),
      is_admin: user.is_admin,
      access_token: this.jwtService.sign(payload),
    };
  }
}
