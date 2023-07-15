import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransfersController } from './transfers.controller';
import { TransferService } from './transfers.service';
import { WalletTransactionsModule } from '../wallet-transactions/wallet-transactions.module';
import { WalletsModule } from '../wallets/wallets.module';
import { Transfer } from './transfer.entity';
import { HelpersModule } from '../utilities/helpers.module';

@Module({
  imports: [
    HelpersModule,
    TypeOrmModule.forFeature([Transfer]),
    WalletTransactionsModule,
    WalletsModule,
  ],
  controllers: [TransfersController],
  providers: [TransferService],
  exports: [TransferService],
})
export class TransfersModule {}
