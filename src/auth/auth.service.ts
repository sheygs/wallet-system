import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { HashService } from '../hash/hash.service';
import { CreateUserDTO } from '../users/dtos/user.dto';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private hashService: HashService,
    private jwtService: JwtService,
  ) {}
  async signup(body: CreateUserDTO): Promise<User> {
    const users = await this.usersService.findUser(
      body.email,
      body.phone_number,
    );

    if (users.length) {
      throw new BadRequestException('user already exists');
    }
    // Hash user password
    const hashPassword = await this.hashService.hashPassword(body.password);

    body.password = hashPassword;

    const user = await this.usersService.createUser(body);

    return user;
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findUser(email);

    if (
      user.length &&
      (await this.hashService.comparePassword(password, user[0].password))
    ) {
      return user;
    }

    return null;
  }

  async login(user: { [key: string]: string | boolean }) {
    const payload = {
      id: user.id,
      email: user.email,
      is_admin: user.is_admin,
    };

    const { id, email, is_admin } = payload;

    return {
      id,
      email,
      is_admin,
      access_token: this.jwtService.sign(payload),
    };
  }
}
