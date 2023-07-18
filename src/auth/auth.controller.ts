import { Controller, Post, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { CreateUserDTO } from '../users/dtos/user.dto';
import { LoginUserDTO } from './dtos/auth.dto';
import { AuthService } from '../auth/auth.service';
import { Helpers } from '../utilities/helpers';
import { SuccessResponse } from 'src/interface/types';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private helpers: Helpers) {}
  @Post('/signup')
  async registerUser(@Body() body: CreateUserDTO): Promise<SuccessResponse> {
    const user = await this.authService.signup(body);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: undefined, ...details } = user;

    return this.helpers.successResponse(
      HttpStatus.CREATED,
      { ...details },
      'User created',
    );
  }

  @Post('/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() authLogin: LoginUserDTO) {
    const loginDetail = await this.authService.login(authLogin);

    return this.helpers.successResponse(
      HttpStatus.OK,
      loginDetail,
      'Login successful',
    );
  }
}
