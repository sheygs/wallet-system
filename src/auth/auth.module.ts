import 'dotenv/config';
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { HashModule } from '../hash/hash.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtPolicy } from './jwt-policy';
import { SharedRateLimit } from './shared-rate-limit';
import { HelpersModule } from '../utilities/helpers.module';

@Module({
  imports: [
    HelpersModule,
    UsersModule,
    HashModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: jwtPolicy(),
    }),
  ],
  providers: [AuthService, SharedRateLimit],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
