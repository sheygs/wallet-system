import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WalletTransactionsService } from './wallet-transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/RolesGuard';
import { TransactionHistoryDTO } from './dto/wallet-transactions.dto';

@Controller('wallet-transactions')
export class WalletTransactionsController {
  constructor(private walletTransactionsService: WalletTransactionsService) {}

  // @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('/history')
  async getTransactionHistory(@Query() queryParams: TransactionHistoryDTO) {
    const transactions =
      await this.walletTransactionsService.getTransactionHistory(queryParams);

    return {
      code: 200,
      status: 'success',
      message: 'transactions retrieved',
      data: transactions,
    };
  }
}
