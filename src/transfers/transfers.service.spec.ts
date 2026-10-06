import { TransferService } from './transfers.service';
import { Repository } from 'typeorm';
import { Transfer } from './transfer.entity';
import { NotFoundException } from '@nestjs/common';

describe('TransferService', () => {
  it('rejects lookup of a missing transfer', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const save = jest.fn();
    const service = new TransferService({
      findOne,
      save,
    } as unknown as Repository<Transfer>);
    await expect(service.getTransfer('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(save).not.toHaveBeenCalled();
  });
});
