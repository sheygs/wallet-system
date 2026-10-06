import { Throttle } from '@nestjs/throttler';
import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenDTO } from './dtos/auth.dto';
import { CreateUserDTO } from '../users/dtos/user.dto';
import { LoginUserDTO } from './dtos/auth.dto';
import { AuthService } from '../auth/auth.service';
import { Helpers } from '../utilities/helpers';
import { SuccessResponse } from '../interface/types';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private helpers: Helpers,
  ) {}
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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

  @Throttle({ default: { limit: 5, ttl: 60000 } })
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

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshTokenDTO) {
    return this.helpers.successResponse(
      HttpStatus.OK,
      await this.authService.refresh(body.refresh_token),
      'Tokens refreshed',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: Request & { user: { userId: string } }) {
    await this.authService.logout(request.user.userId);
    return this.helpers.successResponse(
      HttpStatus.OK,
      {},
      'All sessions revoked',
    );
  }
}
