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
import { Helpers } from '../utilities/helpers';

@Controller('wallets')
export class WalletsController {
  constructor(
    private walletTransactionService: WalletTransactionsService,
    private walletService: WalletsService,
    private userService: UsersService,
    private helpersService: Helpers,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('/')
  async createWallet(@Body() body: CreateWalletDTO) {
    // check if the account for that user exists
    const user = await this.userService.getUserById(body.user_id);

    // check for duplicate currency wallet creation
    const existingWallet = await this.walletService.searchWallet({
      user_id: user.id,
      currency: body.currency,
    });

    if (!existingWallet) {
      const wallet = await this.walletService.createWallet(body);

      return this.helpersService.successResponse(201, wallet, 'Wallet created');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('/:wallet_id/balance')
  async getWalletBalance(@Param() { wallet_id }: GetWalletDTO) {
    const existingWallet = await this.walletService.getWalletByID(wallet_id);

    const { currency, balance } = existingWallet;

    return this.helpersService.successResponse(
      200,
      { currency, balance },
      'Wallet balance retrieved',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/initialize-payment')
  async initializePayment(@Body() body: initializePaymentDTO) {
    const wallet = await this.walletService.getWalletByID(body.wallet_id);

    // call paystack API to initialize payment
    const response = await this.walletService.initializePaymentTransaction({
      email: wallet?.user?.email,
      amount: String(body.amount),
      currency: wallet.currency,
      wallet_id: wallet.id,
      user_id: wallet.user_id,
    });

    return this.helpersService.successResponse(
      200,
      response,
      'Payment initialized successfully',
    );
  }

  @UseGuards(JwtAuthGuard)
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
        amount: Number(amount),
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
        amount: Number(amount),
        transaction_type: TransactionType.DEPOSIT,
        transaction_status: TransactionStatus.SUCCESSFUL,
      }),

      // update the user's wallet balance
      this.walletService.updateWalletBalance(wallet_id, amount, 'INC'),
    ]);

    return this.helpersService.successResponse(200, response, 'wallet funded');
  }
}
