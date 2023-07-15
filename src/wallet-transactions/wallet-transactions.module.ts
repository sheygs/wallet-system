import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletTransactionsController } from './wallet-transactions.controller';
import { WalletTransactionsService } from './wallet-transactions.service';
import { WalletTransaction } from './wallet-transaction.entity';
import { HelpersModule } from '../utilities/helpers.module';

@Module({
  imports: [TypeOrmModule.forFeature([WalletTransaction]), HelpersModule],
  controllers: [WalletTransactionsController],
  providers: [WalletTransactionsService],
  exports: [WalletTransactionsService],
})
export class WalletTransactionsModule {}
