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
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { WalletTransactionsModule } from './wallet-transactions/wallet-transactions.module';
import { TransfersModule } from './transfers/transfers.module';
import { User } from './users/user.entity';
import { Wallet } from './wallets/wallet.entity';
import { WalletTransaction } from './wallet-transactions/wallet-transaction.entity';
import { Transfer } from './transfers/transfer.entity';
import { AuthModule } from './auth/auth.module';
import { HashModule } from './hash/hash.module';
import { PaystackModule } from './utilities/paystack.module';
import { HelpersModule } from './utilities/helpers.module';
import { HttpExceptionFilter } from './exceptions/http-exception.filter';
import winstonLogger from './utilities/logger';
@Module({
  imports: [
    WinstonModule.forRoot({
      ...winstonLogger,
    }),

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    UsersModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: +process.env.POSTGRES_PORT,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      entities: [User, Wallet, WalletTransaction, Transfer],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    UsersModule,
    WalletsModule,
    WalletTransactionsModule,
    TransfersModule,
    AuthModule,
    HashModule,
    PaystackModule,
    HelpersModule,
  ],
  controllers: [AppController],
  providers: [
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
