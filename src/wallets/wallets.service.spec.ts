import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { WalletsService } from './wallets.service';
import { Currency, Wallet } from './wallet.entity';
import {
  SUCCESSFUL_DEPOSIT_UNIQUE_INDEX,
  WalletTransaction,
} from '../wallet-transactions/wallet-transaction.entity';
import { PaystackService } from '../utilities/paystack';

describe('Wallet security', () => {
  let service: WalletsService;
  let wallets: Wallet[];
  let manager: any;
  let payment: any;
  const originalThreshold = process.env.MININUM_APPROVAL_AMOUNT;

  afterAll(() => {
    if (originalThreshold === undefined)
      delete process.env.MININUM_APPROVAL_AMOUNT;
    else process.env.MININUM_APPROVAL_AMOUNT = originalThreshold;
  });

  beforeEach(() => {
    process.env.MININUM_APPROVAL_AMOUNT = '1000';
    wallets = [
      {
        id: 'source',
        user_id: 'owner',
        currency: Currency.NGN,
        kobo_balance: 5000,
      },
      {
        id: 'destination',
        user_id: 'recipient',
        currency: Currency.NGN,
        kobo_balance: 1000,
      },
    ] as Wallet[];

    const builder: any = {
      getMany: jest.fn().mockImplementation(async () => wallets),
    };

    for (const method of ['where', 'orderBy', 'setLock'])
      builder[method] = jest.fn().mockReturnValue(builder);

    manager = {
      getRepository: jest
        .fn()
        .mockReturnValue({ createQueryBuilder: () => builder }),
      save: jest.fn().mockImplementation(async (_entity, value) => value),
      create: jest.fn().mockImplementation((_entity, value) => value),
      query: jest.fn().mockResolvedValue([]),
      findOne: jest
        .fn()
        .mockImplementation(async (entity) =>
          entity === Wallet ? wallets[0] : null,
        ),
    };

    payment = {
      data: {
        status: 'success',
        reference: 'payment',
        amount: 1000,
        currency: 'NGN',
        metadata: { wallet_id: 'source', user_id: 'owner' },
      },
      status: true,
    };

    service = new WalletsService(
      null,
      {
        verifyTransaction: jest.fn().mockImplementation(async () => payment),
      } as unknown as PaystackService,
      {
        transaction: async (isolationOrFn: any, fn?: any) =>
          (typeof isolationOrFn === 'function' ? isolationOrFn : fn)(manager),
      } as unknown as DataSource,
    );
  });

  const transfer = {
    source_wallet_id: 'source',
    destination_wallet_id: 'destination',
    amount: 1000,
    currency: Currency.NGN,
    reason: '',
  };

  it('rejects transfers from another user before any writes', async () => {
    await expect(
      service.transfer(transfer, 'attacker', 'unit-transfer'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid amount %s',
    async (amount) => {
      await expect(
        service.transfer({ ...transfer, amount }, 'owner', 'unit-transfer'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(manager.save).not.toHaveBeenCalled();
    },
  );

  it('rejects insufficient funds', async () => {
    await expect(
      service.transfer({ ...transfer, amount: 6000 }, 'owner', 'unit-transfer'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects cross-currency transfers', async () => {
    wallets[1].currency = Currency.USD;
    await expect(
      service.transfer(transfer, 'owner', 'unit-transfer'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects recipient balance overflow', async () => {
    wallets[1].kobo_balance = Number.MAX_SAFE_INTEGER;
    await expect(
      service.transfer(transfer, 'owner', 'unit-transfer'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('saves both balances and a successful ledger entry in the transaction', async () => {
    await service.transfer(transfer, 'owner', 'unit-transfer');
    expect(wallets.map((w) => w.kobo_balance)).toEqual([4000, 2000]);
    expect(manager.save).toHaveBeenCalledWith(
      WalletTransaction,
      expect.objectContaining({
        user_id: 'owner',
        amount: 1000,
        transaction_status: 'successful',
      }),
    );
  });

  it('rejects already credited references', async () => {
    manager.findOne.mockImplementation(async (entity: any) =>
      entity === Wallet ? wallets[0] : { reference: 'payment' },
    );
    await expect(service.deposit('payment', 'owner')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it.each(['failed', 'pending'])(
    'rejects payment status %s',
    async (status) => {
      payment.data.status = status;
      await expect(service.deposit('payment', 'owner')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(manager.save).not.toHaveBeenCalled();
    },
  );

  it('rejects mismatched payment identity', async () => {
    payment.data.metadata.user_id = 'attacker';
    await expect(service.deposit('payment', 'owner')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('credits the verified provider amount', async () => {
    await service.deposit('payment', 'owner');
    expect(wallets[0].kobo_balance).toBe(6000);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      ['payment'],
    );
  });

  it.each(['', ' ', '\t\n'])(
    'rejects a blank payment reference %j',
    async (reference) => {
      await expect(service.deposit(reference, 'owner')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(manager.query).not.toHaveBeenCalled();
    },
  );

  it('preserves cents at the maximum supported minor-unit balance', async () => {
    wallets[0].kobo_balance = Number.MAX_SAFE_INTEGER - 1000;
    await service.deposit('payment', 'owner');
    expect(wallets[0].kobo_balance).toBe(Number.MAX_SAFE_INTEGER);
    expect(wallets[0].balance).toBe('90071992547409.91');
  });

  it('maps a successful-deposit index collision to HTTP 409', async () => {
    manager.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate'), {
          code: '23505',
          constraint: SUCCESSFUL_DEPOSIT_UNIQUE_INDEX,
        }),
      ),
    );
    await expect(service.deposit('payment', 'owner')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('does not hide unrelated database errors as replay conflicts', async () => {
    const error = new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('foreign key'), {
        code: '23503',
        constraint: 'wallet_transactions_wallet_fk',
      }),
    );
    manager.save.mockRejectedValue(error);
    await expect(service.deposit('payment', 'owner')).rejects.toBe(error);
  });
});
