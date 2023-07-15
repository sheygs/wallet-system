import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Transfer } from './transfer.entity';
import { CreateTransferDTO } from './dto/transfer.dto';

@Injectable()
export class TransferService {
  constructor(
    @InjectRepository(Transfer)
    private transferRepository: Repository<Transfer>,
  ) {}

  async createWalletTransfer(body: CreateTransferDTO) {
    const { amount, ...others } = body;

    const walletTransfer = await this.transferRepository.create({
      ...others,
      transferred_amount: amount,
    });

    return this.transferRepository.save(walletTransfer);
  }

  async getTransfer(transfer_id: string) {
    const transfer = await this.transferRepository.findOne({
      where: {
        id: transfer_id,
      },
    });

    if (!transfer) {
      throw new NotFoundException('transfer not found');
    }

    return transfer;
  }

  async changeApproval(transfer_id: string, approved: boolean) {
    const transfer = await this.getTransfer(transfer_id);

    transfer.approved = approved;

    return this.transferRepository.save(transfer);
  }
}
