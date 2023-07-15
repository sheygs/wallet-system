import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { Wallet } from './wallet.entity';
import { UsersModule } from '../users/users.module';
import { WalletTransactionsModule } from '../wallet-transactions/wallet-transactions.module';
import { PaystackModule } from '../utilities/paystack.module';
import { HelpersModule } from '../utilities/helpers.module';

@Module({
  imports: [
    HelpersModule,
    TypeOrmModule.forFeature([Wallet]),
    UsersModule,
    WalletTransactionsModule,
    PaystackModule,
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
