import { CreateWalletDTO, SearchWalletDTO } from './dtos/wallet.dto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Wallet } from './wallet.entity';
import { PaystackService } from '../utilities/paystack';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet) private walletRepository: Repository<Wallet>,
    private paystackService: PaystackService,
  ) {}

  async createWallet(body: CreateWalletDTO): Promise<Wallet> {
    const wallet = this.walletRepository.create(body);

    if (!wallet) {
      throw new UnprocessableEntityException('Wallet creation failed');
    }

    return this.walletRepository.save(wallet);
  }

  async getWalletByID(wallet_id: string) {
    const wallet = await this.walletRepository.findOne({
      where: {
        id: wallet_id,
      },

      relations: {
        user: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet account not found');
    }

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

    if (wallet) {
      throw new ConflictException(
        'Wallet of the specified currency already exists',
      );
    }

    return wallet;
  }

  async updateWalletBalance(id: string, amount: number) {
    const wallet = await this.getWalletByID(id);

    wallet.balance = Number(wallet.balance) + Number(amount);

    await wallet.save();
  }

  async getWalletBalance(id: string) {
    const wallet = await this.getWalletByID(id);

    return wallet.balance;
  }

  async initializePaymentTransaction(payload: any) {
    const { amount, email, currency, wallet_id, user_id } = payload;

    const response = await this.paystackService.initializeTransaction({
      amount,
      email,
      currency,
      metadata: {
        amount,
        wallet_id,
        user_id: user_id || '4b4e29f9-4a9c-4af7-81b0-156c080e5830',
      },
    });

    if (!response) {
      throw new UnprocessableEntityException(
        'Paystack payment initiailzation failed',
      );
    }

    if (!response.status) {
      throw new UnprocessableEntityException(response.message);
    }

    return { authorization_url: response.data.authorization_url };
  }

  async verifyPaymentTransaction(reference: string) {
    const transaction = await this.paystackService.verifyTransaction(reference);

    if (!transaction.status) {
      throw new UnprocessableEntityException(transaction.message);
    }

    return transaction;
  }
}
