import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Transfer } from './transfer.entity';

@Injectable()
export class TransferService {
  constructor(
    @InjectRepository(Transfer)
    private transferRepository: Repository<Transfer>,
  ) {}

  async getTransfer(transfer_id: string): Promise<Transfer> {
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
}
