import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletTransfersController } from './wallet-transfers.controller';
import { WalletTransfersService } from './wallet-transfers.service';
import { WalletTransfer } from './wallet-transfer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WalletTransfer])],
  controllers: [WalletTransfersController],
  providers: [WalletTransfersService],
})
export class WalletTransfersModule {}
