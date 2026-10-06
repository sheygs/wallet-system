import {
  Controller,
  Req,
  ForbiddenException,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
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
  async createWallet(
    @Body() body: CreateWalletDTO,
    @Req() request: { user: { userId: string } },
  ) {
    if (body.user_id !== request.user.userId)
      throw new ForbiddenException('Cannot create a wallet for another user');

    const user = await this.userService.getUserById(body.user_id);

    if (!user) {
      throw new NotFoundException('No account exists for this user');
    }

    const wallet = await this.walletService.createWallet(body);

    return this.helpersService.successResponse(
      HttpStatus.CREATED,
      wallet,
      'Wallet created',
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Get('/:wallet_id/balance')
  async getWalletBalance(
    @Param() { wallet_id }: GetWalletDTO,
    @Req() request: { user: { userId: string } },
  ) {
    const existingWallet = await this.walletService.getWalletByID(wallet_id);

    this.walletService.assertOwner(existingWallet, request.user.userId);

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
  async initializePayment(
    @Body() body: InitializePaymentDTO,
    @Req() request: { user: { userId: string } },
  ) {
    const wallet = await this.walletService.getWalletByID(body.wallet_id);

    this.walletService.assertOwner(wallet, request.user.userId);
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
  async creditWallet(
    @Body() body: FundWalletDTO,
    @Req() request: { user: { userId: string } },
  ) {
    await this.walletService.deposit(body.reference, request.user.userId);

    return this.helpersService.successResponse(
      HttpStatus.OK,
      {},
      'Wallet funded',
    );
  }
}
