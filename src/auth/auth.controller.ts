import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { CreateUserDTO } from '../users/dtos/user.dto';
import { AuthService } from '../auth/auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Helpers } from '../utilities/helpers';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private helpers: Helpers) {}
  @Post('/signup')
  async registerUser(@Body() body: CreateUserDTO) {
    const user = await this.authService.signup(body);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...details } = user;

    return this.helpers.successResponse(201, { ...details }, 'User created');
  }

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }
}
