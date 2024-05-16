import {
  Controller,
  Post,
  Body,
  UnprocessableEntityException,
  Patch,
  UseGuards,
  Param,
  HttpStatus,
  HttpCode,
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
import { Transfer } from './transfer.entity';
import { SuccessResponse } from '../interface/types';

@Controller('transfers')
export class TransfersController {
  constructor(
    private transferservice: TransferService,
    private walletTransactionsService: WalletTransactionsService,
    private walletService: WalletsService,
    private helperService: Helpers,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('/')
  async createWalletTransfer(
    @Body() body: CreateTransferDTO,
  ): Promise<SuccessResponse> {
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

    if (
      Number(sourceWalletBalance) <= 0 ||
      Number(sourceWalletBalance) < amount
    ) {
      throw new UnprocessableEntityException('Insufficient funds');
    }

    await this.walletService.updateWalletBalance(
      source_wallet_id,
      String(amount),
      'DEC',
    );

    await this.walletService.updateWalletBalance(
      destination_wallet_id,
      String(amount),
      'INC',
    );

    const transfer: Transfer = await this.transferservice.createWalletTransfer(
      body,
    );

    await this.walletTransactionsService.createTransactionLog({
      source_wallet_id: transfer.source_wallet_id,
      amount: transfer.transferred_amount,
      transaction_type: TransactionType.TRANSFER,
      transaction_status: TransactionStatus.SUCCESSFUL,
      reference: '',
    });

    return this.helperService.successResponse(
      HttpStatus.OK,
      transfer,
      'transfer successful',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Patch('/:transfer_id/approve')
  async approveTransfer(
    @Param() { transfer_id }: TransferIdDTO,
    @Body() body: ApproveTransferDTO,
  ): Promise<SuccessResponse> {
    const { approved } = body;

    const transfer = await this.transferservice.getTransfer(transfer_id);

    const approvalAmount = +this.helperService.TRANSFER_AMOUNT;

    if (Number(transfer.transferred_amount) <= approvalAmount) {
      throw new UnprocessableEntityException(
        `Unable to approve tranfer of ${approvalAmount} or less`,
      );
    }

    await this.transferservice.changeApproval(transfer.id, approved);

    return this.helperService.successResponse(
      HttpStatus.OK,
      {},
      'transfer approved',
    );
  }
}
