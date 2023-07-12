import { Controller, Post, Body } from '@nestjs/common';
import { CreateUserDto } from './dtos/create-user.dto';
import { UsersService } from './users.service';

@Controller('auth')
export class UsersController {
  constructor(private userService: UsersService) {}
  @Post('/signup')
  async registerUser(@Body() body: CreateUserDto) {
    const user = await this.userService.create(body.email, body.password);

    console.log({ user });

    return {
      code: 201,
      status: 'success',
      message: 'User created',
      data: user,
    };
  }
}
