import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { CreateUserDTO, LoginUserDTO } from '../users/dtos/user.dto';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  @Post('/signup')
  async registerUser(@Body() body: CreateUserDTO) {
    const user = await this.authService.signup(body);

    return {
      code: 201,
      status: 'success',
      message: 'User created',
      data: user,
    };
  }

  @UseGuards(AuthGuard('local'))
  @Post('/login')
  async loginUser(@Request() req) {
    console.log({ u: req.user });
    return req.user;
  }
}
