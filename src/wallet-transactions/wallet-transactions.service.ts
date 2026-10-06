import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { historyPolicy } from './history-policy';
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
  ): Promise<{ items: WalletTransaction[]; next_cursor: string | null }> {
    const { from, until, limit, scope, cursor } = historyPolicy(queryParams);
    const query = this.walletTransactionRepository
      .createQueryBuilder('transaction')
      .where(
        'transaction.created_at >= :from AND transaction.created_at < :until',
        {
          from: from.toISOString().slice(0, -1),
          until: until.toISOString().slice(0, -1),
        },
      )
      .addSelect(
        `to_char(transaction.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US')`,
        'cursor_at',
      )
      .orderBy('transaction.created_at', 'ASC')
      .addOrderBy('transaction.id', 'ASC')
      .take(limit + 1);

    if (cursor)
      query.andWhere(
        '(transaction.created_at, transaction.id) > (CAST(:at AS timestamp), CAST(:id AS uuid))',
        cursor,
      );

    const { entities, raw } = await query.getRawAndEntities();
    const hasMore = entities.length > limit;
    const items = entities.slice(0, limit);
    const last = items[items.length - 1];

    return {
      items,
      next_cursor: hasMore
        ? Buffer.from(
            JSON.stringify({
              v: 1,
              scope,
              at: raw[limit - 1].cursor_at,
              id: last.id,
            }),
          ).toString('base64url')
        : null,
    };
  }
}
