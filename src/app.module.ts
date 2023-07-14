import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { WalletTransactionsModule } from './wallet-transactions/wallet-transactions.module';
import { WalletTransfersModule } from './wallet-transfers/wallet-transfers.module';
import { User } from './users/user.entity';
import { Wallet } from './wallets/wallet.entity';
import { WalletTransaction } from './wallet-transactions/wallet-transaction.entity';
import { WalletTransfer } from './wallet-transfers/wallet-transfer.entity';
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

    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: '',
      password: '',
      database: 'account',
      entities: [User, Wallet, WalletTransaction, WalletTransfer],
      synchronize: true,
    }),
    UsersModule,
    WalletsModule,
    WalletTransactionsModule,
    WalletTransfersModule,
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
export class AppModule {}
