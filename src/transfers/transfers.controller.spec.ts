import { TransfersController } from './transfers.controller';
import { WalletsService } from '../wallets/wallets.service';
import { Helpers } from '../utilities/helpers';
import { ForbiddenException } from '@nestjs/common';

describe('TransfersController', () => {
  it('passes authenticated identity to the atomic transfer service', async () => {
    const transfer = jest.fn().mockResolvedValue({ id: 'transfer' });
    const controller = new TransfersController(
      { transfer } as unknown as WalletsService,
      new Helpers(),
    );
    const body = {
      source_wallet_id: 'source',
      destination_wallet_id: 'destination',
      amount: 1000,
      currency: undefined,
      reason: undefined,
    };
    await controller.createWalletTransfer(body, 'controller-test', {
      user: { userId: 'owner' },
    });
    expect(transfer).toHaveBeenCalledWith(body, 'owner', 'controller-test');
  });

  it('propagates ownership rejection without reporting success', async () => {
    const transfer = jest.fn().mockRejectedValue(new ForbiddenException());
    const controller = new TransfersController(
      { transfer } as unknown as WalletsService,
      new Helpers(),
    );
    await expect(
      controller.createWalletTransfer(
        {
          source_wallet_id: 'source',
          destination_wallet_id: 'destination',
          amount: 1000,
          currency: undefined,
          reason: undefined,
        },
        'controller-test',
        { user: { userId: 'attacker' } },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
