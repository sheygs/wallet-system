import { ConflictException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { WalletsService } from './wallets.service';
import { ACTIVE_WALLET_UNIQUE_INDEX, Currency, Wallet } from './wallet.entity';

describe('Wallet creation conflicts', () => {
  let service: WalletsService;
  let repository: { create: jest.Mock; findOne: jest.Mock; query: jest.Mock };
  beforeEach(() => {
    repository = {
      create: jest.fn().mockImplementation((body) => body),
      findOne: jest.fn().mockResolvedValue(null),
      query: jest
        .fn()
        .mockImplementation(async (_sql, [user_id, currency]) => [
          { user_id, currency },
        ]),
    };
    service = new WalletsService(
      repository as unknown as Repository<Wallet>,
      null,
      null,
    );
  });

  it('checks and creates NGN when the currency is omitted', async () => {
    const wallet = await service.createWallet({ user_id: 'owner' });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { user_id: 'owner', currency: Currency.NGN },
    });
    expect(wallet.currency).toBe(Currency.NGN);
  });

  it('rejects an existing active wallet before inserting', async () => {
    repository.findOne.mockResolvedValue({ id: 'existing' });
    await expect(
      service.createWallet({ user_id: 'owner' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.query).not.toHaveBeenCalled();
  });

  it('maps a race on the active-wallet index to HTTP 409', async () => {
    repository.query.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate'), {
          code: '23505',
          constraint: ACTIVE_WALLET_UNIQUE_INDEX,
        }),
      ),
    );
    await expect(
      service.createWallet({ user_id: 'owner' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('preserves an unrelated unique-constraint error', async () => {
    const error = new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('duplicate ID'), {
        code: '23505',
        constraint: 'wallets_pkey',
      }),
    );
    repository.query.mockRejectedValue(error);
    await expect(service.createWallet({ user_id: 'owner' })).rejects.toBe(
      error,
    );
  });

  it('preserves database outages rather than misreporting a duplicate', async () => {
    const error = new Error('connection lost');
    repository.query.mockRejectedValue(error);
    await expect(service.createWallet({ user_id: 'owner' })).rejects.toBe(
      error,
    );
  });
});
