import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  UnprocessableEntityException,
  NotFoundException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  CreateWalletDTO,
  GetWalletDTO,
  InitializePaymentDTO,
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
  @HttpCode(HttpStatus.CREATED)
  @Post('/')
  async createWallet(@Body() body: CreateWalletDTO) {
    const user = await this.userService.getUserById(body.user_id);

    if (!user) {
      throw new NotFoundException('No account exists for this user');
    }

    // check for duplicate currency wallet creation
    const existingWallet = await this.walletService.searchWallet({
      user_id: user.id,
      currency: body.currency,
    });

    if (!existingWallet) {
      const wallet = await this.walletService.createWallet(body);

      return this.helpersService.successResponse(
        HttpStatus.CREATED,
        wallet,
        'Wallet created',
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Get('/:wallet_id/balance')
  async getWalletBalance(@Param() { wallet_id }: GetWalletDTO) {
    const existingWallet = await this.walletService.getWalletByID(wallet_id);

    const { currency, balance } = existingWallet;

    return this.helpersService.successResponse(
      HttpStatus.OK,
      { currency, balance },
      'Wallet balance retrieved',
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('/initialize-payment')
  async initializePayment(@Body() body: InitializePaymentDTO) {
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
      HttpStatus.OK,
      response,
      'Payment initialized',
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('/deposit')
  async creditWallet(@Body() body: FundWalletDTO) {
    const response = await this.walletService.verifyPaymentTransaction(
      body.reference,
    );

    const {
      data: {
        reference,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        metadata: { amount, wallet_id, user_id, currency },
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
        reference: reference || body.reference,
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
        reference: reference || body.reference,
      }),

      // update the user's wallet balance
      this.walletService.updateWalletBalance(wallet_id, amount, 'INC'),
    ]);

    return this.helpersService.successResponse(
      HttpStatus.OK,
      response,
      'Wallet funded',
    );
  }
}
