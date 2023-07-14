import { CreateWalletDTO, SearchWalletDTO } from './dtos/wallet.dto';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Wallet } from './wallet.entity';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet) private walletRepository: Repository<Wallet>,
  ) {}

  // createWallet - POST /api/v1/wallets
  async createWallet(body: CreateWalletDTO): Promise<Wallet> {
    const wallet = this.walletRepository.create(body);

    return this.walletRepository.save(wallet);
  }

  async getWalletByID(wallet_id: string) {
    const wallet = await this.walletRepository.findOne({
      where: {
        id: wallet_id,
      },
    });

    return wallet;
  }

  async searchWallet(params: SearchWalletDTO): Promise<Wallet> {
    const { user_id, currency } = params;

    const wallet = await this.walletRepository.findOne({
      where: {
        user_id,
        ...(currency && { currency }),
      },
    });

    return wallet;
  }

  // fundWallet
  // checkWalletBalance
  // updateWalletBalance
}
