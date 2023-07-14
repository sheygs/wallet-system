import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { WalletTransaction } from './wallet-transaction.entity';
import { CreateTransactionDTO } from './dto/wallet-transactions.dto';

@Injectable()
export class WalletTransactionsService {
  constructor(
    @InjectRepository(WalletTransaction)
    private walletTransactionRepository: Repository<WalletTransaction>,
  ) {}

  async createTransactionLog(body: CreateTransactionDTO) {
    const transaction = this.walletTransactionRepository.create(body);

    return this.walletTransactionRepository.save(transaction);
  }
}
