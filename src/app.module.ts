import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import 'dotenv/config';
import { WinstonModule } from 'nest-winston';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { WalletTransactionsModule } from './wallet-transactions/wallet-transactions.module';
import { TransfersModule } from './transfers/transfers.module';
import { AuthModule } from './auth/auth.module';
import { HashModule } from './hash/hash.module';
import { PaystackModule } from './utilities/paystack.module';
import { HelpersModule } from './utilities/helpers.module';
import { HttpExceptionFilter } from './exceptions/http-exception.filter';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import winstonLogger from './utilities/logger';
@Module({
  imports: [
    WinstonModule.forRoot({
      ...winstonLogger,
    }),
    UsersModule,
    DatabaseModule,
    WalletsModule,
    WalletTransactionsModule,
    TransfersModule,
    AuthModule,
    HashModule,
    PaystackModule,
    HelpersModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [
    JwtStrategy,
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply().forRoutes({ path: 'wallets*', method: RequestMethod.ALL });
    consumer
      .apply()
      .forRoutes({ path: 'transfers*', method: RequestMethod.ALL });
    consumer
      .apply()
      .forRoutes({ path: 'wallet-transactions*', method: RequestMethod.ALL });
  }
}
