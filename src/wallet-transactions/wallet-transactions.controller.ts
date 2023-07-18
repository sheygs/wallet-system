import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WalletTransactionsService } from './wallet-transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/RolesGuard';
import { TransactionHistoryDTO } from './dto/wallet-transactions.dto';
import { Helpers } from '../utilities/helpers';

@Controller('wallet-transactions')
export class WalletTransactionsController {
  constructor(
    private walletTransactionsService: WalletTransactionsService,
    public helpersService: Helpers,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Get('/history')
  async getTransactionHistory(@Query() queryParams: TransactionHistoryDTO) {
    const transactions =
      await this.walletTransactionsService.getTransactionHistory(queryParams);

    return this.helpersService.successResponse(
      HttpStatus.OK,
      transactions,
      'transactions retrieved',
    );
  }
}
