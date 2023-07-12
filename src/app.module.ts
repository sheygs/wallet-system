import { Module } from '@nestjs/common';
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
@Module({
  imports: [
    ConfigModule.forRoot(),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
