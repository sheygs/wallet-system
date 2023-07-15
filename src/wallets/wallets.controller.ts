import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CreateWalletDTO,
  GetWalletDTO,
  initializePaymentDTO,
  FundWalletDTO,
} from '../wallets/dtos/wallet.dto';
import { UsersService } from '../users/users.service';
import { WalletsService } from './wallets.service';
import { WalletTransactionsService } from '../wallet-transactions/wallet-transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  TransactionStatus,
  TransactionType,
} from '../wallet-transactions/wallet-transaction.entity';

@Controller('wallets')
export class WalletsController {
  constructor(
    private walletTransactionService: WalletTransactionsService,
    private walletService: WalletsService,
    private userService: UsersService,
  ) {}

  // @UseGuards(JwtAuthGuard)
  @Post('/')
  async createWallet(@Body() body: CreateWalletDTO) {
    // check if the account for that user exists
    const user = await this.userService.getUserById(body.user_id);

    // check if the user has already created a wallet for that currency
    const existingWallet = await this.walletService.searchWallet({
      user_id: user.id,
      currency: body.currency,
    });

    if (!existingWallet) {
      const wallet = await this.walletService.createWallet(body);

      return {
        code: 201,
        status: 'success',
        message: 'Wallet created',
        data: wallet,
      };
    }
  }

  // @UseGuards(JwtAuthGuard)
  @Get('/:wallet_id/balance')
  async getWalletBalance(@Param() { wallet_id }: GetWalletDTO) {
    const existingWallet = await this.walletService.getWalletByID(wallet_id);

    const { currency, balance } = existingWallet;

    return {
      code: 200,
      status: 'success',
      message: 'Wallet balance retrieved',
      data: { currency, balance },
    };
  }

  // @UseGuards(JwtAuthGuard)
  @Post('/initialize-payment')
  async initializePayment(@Body() body: initializePaymentDTO) {
    const wallet = await this.walletService.getWalletByID(body.wallet_id);

    // call paystack API to initiate payment
    const response = await this.walletService.initializePaymentTransaction({
      email: wallet?.user?.email,
      amount: String(body.amount),
      currency: wallet.currency,
      wallet_id: wallet.id,
      user_id: wallet.user_id,
    });

    return {
      code: 200,
      status: 'success',
      message: 'Payment initialized successfully',
      data: response,
    };
  }

  // @UseGuards(JwtAuthGuard)
  @Post('/deposit')
  async creditWallet(@Body() body: FundWalletDTO) {
    const response = await this.walletService.verifyPaymentTransaction(
      body.reference,
    );

    const {
      data: {
        metadata: { amount, wallet_id, user_id },
        status: transactionStatus,
        gateway_response,
      },
    } = await this.walletService.verifyPaymentTransaction(body.reference);

    if (transactionStatus !== 'success') {
      await this.walletTransactionService.createTransactionLog({
        user_id,
        source_wallet_id: wallet_id,
        amount,
        transaction_type: TransactionType.DEPOSIT,
        transaction_status: TransactionStatus.FAILED,
      });

      throw new UnprocessableEntityException(gateway_response);
    }

    await Promise.all([
      // log transaction
      this.walletTransactionService.createTransactionLog({
        user_id,
        source_wallet_id: wallet_id,
        amount,
        transaction_type: TransactionType.DEPOSIT,
        transaction_status: TransactionStatus.SUCCESSFUL,
      }),

      // update the user's wallet balance
      this.walletService.updateWalletBalance(wallet_id, amount, 'INC'),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Wallet funded',
      response,
    };
  }
}
