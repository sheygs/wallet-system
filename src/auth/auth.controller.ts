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
// import { Roles } from './constant';
// import { RolesAllowed } from './decorators/roles-allowed.decorators';

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

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  // @RolesAllowed(Roles.ADMIN)
  @Get('profile')
  getProfile(@Request() req) {
    // console.log({ req });
    // return req.user;
    return 'ok';
  }
}
