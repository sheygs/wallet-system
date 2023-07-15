import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
} from '@nestjs/common';
import { CreateUserDTO } from '../users/dtos/user.dto';
import { AuthService } from '../auth/auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/RolesGuard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  @Post('/signup')
  async registerUser(@Body() body: CreateUserDTO) {
    const user = await this.authService.signup(body);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...details } = user;

    return {
      code: 201,
      status: 'success',
      message: 'User created',
      data: {
        ...details,
      },
    };
  }

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }
}
