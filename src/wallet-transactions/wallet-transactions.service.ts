import { Injectable } from '@nestjs/common';
import { Between, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { WalletTransaction } from './wallet-transaction.entity';
import {
  CreateTransactionDTO,
  TransactionHistoryDTO,
} from './dto/wallet-transactions.dto';

@Injectable()
export class WalletTransactionsService {
  constructor(
    @InjectRepository(WalletTransaction)
    private walletTransactionRepository: Repository<WalletTransaction>,
  ) {}

  async createTransactionLog(
    body: CreateTransactionDTO,
  ): Promise<WalletTransaction> {
    const transaction: WalletTransaction =
      this.walletTransactionRepository.create(body);

    return this.walletTransactionRepository.save(transaction);
  }

  // transaction summary by month or date range filtering
  async getTransactionHistory(
    queryParams: TransactionHistoryDTO,
  ): Promise<WalletTransaction[]> {
    // eslint-disable-next-line prefer-const
    let { from_date, to_date, target_month, target_year } = queryParams;

    from_date = new Date(from_date);
    to_date = new Date(to_date);

    // targetMonth - 1 to adjust for JavaScript month indexing (January is month 0)
    if (target_month && target_year) {
      from_date = new Date(+target_year, +target_month - 1, 1);
      to_date = new Date(+target_year, +target_month, 0);
    }

    const transactions = await this.walletTransactionRepository.find({
      where: {
        created_at: Between(from_date, to_date),
      },
    });

    return transactions;
  }
}
