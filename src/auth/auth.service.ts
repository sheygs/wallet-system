import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { HashService } from '../hash/hash.service';
import { CreateUserDTO, LoginUserDTO } from '../users/dtos/user.dto';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private hashService: HashService,
  ) {}
  async signup(body: CreateUserDTO): Promise<User> {
    const users = await this.usersService.findUser(
      body.email,
      body.phone_number,
    );

    console.log({ users });

    if (users.length) {
      throw new BadRequestException('user already exists');
    }
    // Hash user password
    const hashPassword = await this.hashService.hashPassword(body.password);

    body.password = hashPassword;

    const user = await this.usersService.createUser(body);

    return user;
  }

  async validateUser(email: string, password: string): Promise<User> | null {
    const user = await this.usersService.findOneUser(
      email,
      // phone_number,
    );

    console.log({ user });

    //  if (
    //    user &&
    //    (await this.hashService.comparePassword(password, user.password))
    //  ) {
    //    return user;
    //  }

    //  return null;
    return user;
  }
}
