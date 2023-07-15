import {
  Controller,
  Post,
  Body,
  UnprocessableEntityException,
  Patch,
  UseGuards,
  Param,
} from '@nestjs/common';
import { TransferService } from './transfers.service';
import {
  CreateTransferDTO,
  TransferIdDTO,
  ApproveTransferDTO,
} from './dto/transfer.dto';
import { WalletTransactionsService } from '../wallet-transactions/wallet-transactions.service';
import { WalletsService } from '../wallets/wallets.service';
import {
  TransactionStatus,
  TransactionType,
} from '../wallet-transactions/wallet-transaction.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/RolesGuard';
import { Helpers } from '../utilities/helpers';

@Controller('transfers')
export class TransfersController {
  constructor(
    private transferservice: TransferService,
    private walletTransactionsService: WalletTransactionsService,
    private walletService: WalletsService,
    private helperService: Helpers,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('/')
  async createWalletTransfer(@Body() body: CreateTransferDTO) {
    const { source_wallet_id, destination_wallet_id, amount } = body;

    const sourceWallet = await this.walletService.getWalletByID(
      source_wallet_id,
    );

    const destinationWallet = await this.walletService.getWalletByID(
      destination_wallet_id,
    );

    const sourceWalletBalance = await this.walletService.getWalletBalance(
      sourceWallet.id,
    );

    if (sourceWallet.currency !== destinationWallet.currency) {
      throw new UnprocessableEntityException(
        'unable to transfer to wallet of different currency',
      );
    }

    if (+sourceWalletBalance <= 0 || +sourceWalletBalance < amount) {
      throw new UnprocessableEntityException('Insufficient funds');
    }

    await this.walletService.updateWalletBalance(
      source_wallet_id,
      amount,
      'DEC',
    );

    await this.walletService.updateWalletBalance(
      destination_wallet_id,
      amount,
      'INC',
    );

    const transfer = await this.transferservice.createWalletTransfer(body);

    await this.walletTransactionsService.createTransactionLog({
      source_wallet_id: transfer.source_wallet_id,
      amount: transfer.transferred_amount,
      transaction_type: TransactionType.TRANSFER,
      transaction_status: TransactionStatus.SUCCESSFUL,
    });

    return this.helperService.successResponse(
      201,
      transfer,
      'transfer successful',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('/:transfer_id/approve')
  async approveTransfer(
    @Param() { transfer_id }: TransferIdDTO,
    @Body() body: ApproveTransferDTO,
  ) {
    const { approved } = body;

    const transfer = await this.transferservice.getTransfer(transfer_id);

    if (+transfer.transferred_amount > 1000000) {
      await this.transferservice.changeApproval(transfer.id, approved);
    }

    return this.helperService.successResponse(
      200,
      transfer,
      'transfer successful',
    );
  }
}
