import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  NotFoundException,
  ConflictException,
  Param,
} from '@nestjs/common';
import { CreateWalletDTO, GetWalletDTO } from '../wallets/dtos/wallet.dto';
import { UsersService } from '../users/users.service';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('wallets')
export class WalletsController {
  constructor(
    private walletService: WalletsService,
    private userService: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('/')
  async createWallet(@Body() body: CreateWalletDTO) {
    // first check if the account for that user exists
    const user = await this.userService.getUserById(body.user_id);

    if (!user) {
      throw new NotFoundException('No account exists for this user');
    }

    // check if the user has already created a wallet for that currency
    const existingWallet = await this.walletService.searchWallet(body);

    if (existingWallet) {
      throw new ConflictException(
        'Wallet of the specified currency already exists',
      );
    }

    const wallet = await this.walletService.createWallet(body);

    return {
      code: 201,
      status: 'success',
      message: 'Wallet created',
      data: wallet,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('/:wallet_id/balance')
  async getWalletBalance(@Param() { wallet_id }: GetWalletDTO) {
    const existingWallet = await this.walletService.getWalletByID(wallet_id);

    if (!existingWallet) {
      throw new NotFoundException(
        'No wallet account associated with this user',
      );
    }

    const { currency, balance } = existingWallet;

    return {
      code: 200,
      status: 'success',
      message: 'Wallet balance retrieved',
      data: { currency, balance },
    };
  }
}
