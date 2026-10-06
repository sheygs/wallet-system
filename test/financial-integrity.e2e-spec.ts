import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PaystackService } from '../src/utilities/paystack';
import { WalletsService } from '../src/wallets/wallets.service';
import { User } from '../src/users/user.entity';
import { Currency, Wallet } from '../src/wallets/wallet.entity';
import { Transfer } from '../src/transfers/transfer.entity';
import {
  TransactionStatus,
  TransactionType,
  WalletTransaction,
  SUCCESSFUL_DEPOSIT_UNIQUE_INDEX,
} from '../src/wallet-transactions/wallet-transaction.entity';

describe('Financial database safeguards', () => {
  let app: INestApplication;
  let db: DataSource;
  let owner: User;
  let source: Wallet;
  let destination: Wallet;
  const verifyTransaction = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PaystackService)
      .useValue({ verifyTransaction })
      .compile();
    app = module.createNestApplication();
    await app.init();
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    owner = await db.getRepository(User).save({
      first_name: 'Test',
      last_name: 'Owner',
      email: 'integrity-owner@example.com',
      password: 'unused-fixture-hash',
    });
    const recipient = await db.getRepository(User).save({
      first_name: 'Test',
      last_name: 'Recipient',
      email: 'integrity-recipient@example.com',
      password: 'unused-fixture-hash',
    });
    source = await db.getRepository(Wallet).save({
      user_id: owner.id,
      currency: Currency.NGN,
      kobo_balance: 5000,
      balance: 50,
    });
    destination = await db
      .getRepository(Wallet)
      .save({ user_id: recipient.id, currency: Currency.NGN });
  });

  afterEach(async () => {
    // Privileged cleanup of the disposable test database; product code never truncates the ledger.
    await db.query('TRUNCATE wallet_transactions');
    await db.query('TRUNCATE transfer_requests');
    await db.query('DELETE FROM transfers');
    await db.query('DELETE FROM wallets');
    await db.query('DELETE FROM users');
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await app.close();
  });

  function depositRow(reference = 'paid-reference') {
    return {
      user_id: owner.id,
      source_wallet_id: source.id,
      amount: 1000,
      reference,
      transaction_type: TransactionType.DEPOSIT,
      transaction_status: TransactionStatus.SUCCESSFUL,
    };
  }

  function transferRow() {
    return {
      source_wallet_id: source.id,
      destination_wallet_id: destination.id,
      transferred_amount: 1000,
      requested_by: owner.id,
    };
  }

  function verifiedPayment(reference: string) {
    verifyTransaction.mockResolvedValue({
      status: true,
      data: {
        status: 'success',
        reference,
        amount: 1000,
        currency: 'NGN',
        metadata: { wallet_id: source.id, user_id: owner.id },
      },
    });
  }

  it.each(['0', '-1', '1.5', '9007199254740992', 'NaN', 'Infinity'])(
    'rejects invalid ledger and transfer amount %s',
    async (amount) => {
      await expect(
        db
          .getRepository(WalletTransaction)
          .save({ ...depositRow(), amount: amount as unknown as number }),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'wallet_transactions_amount_valid',
      });
      await expect(
        db.getRepository(Transfer).save({
          ...transferRow(),
          transferred_amount: amount as unknown as number,
        }),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'transfers_amount_valid',
      });
      expect(await db.getRepository(WalletTransaction).count()).toBe(0);
      expect(await db.getRepository(Transfer).count()).toBe(0);
    },
  );

  it.each(['-1', '1.5', '9007199254740992', 'NaN', 'Infinity'])(
    'rejects invalid minor-unit balance %s',
    async (balance) => {
      await expect(
        db.query(
          'UPDATE wallets SET kobo_balance = $1::numeric, balance = $1::numeric / 100 WHERE id = $2',
          [balance, source.id],
        ),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'wallets_balances_valid',
      });
      expect(
        Number(
          (await db.getRepository(Wallet).findOneByOrFail({ id: source.id }))
            .kobo_balance,
        ),
      ).toBe(5000);
    },
  );

  it('rejects inconsistent display and minor-unit balances', async () => {
    await expect(
      db.getRepository(Wallet).update(source.id, { balance: 51 }),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'wallets_balances_valid',
    });
  });

  it.each([null, '', ' \t\n'])(
    'requires a nonblank successful deposit reference %j',
    async (reference) => {
      await expect(
        db
          .getRepository(WalletTransaction)
          .save({ ...depositRow(), reference }),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'wallet_transactions_deposit_reference_required',
      });
    },
  );

  it('allows only one successful reference even when direct writers race across wallets', async () => {
    const results = await Promise.allSettled([
      db.getRepository(WalletTransaction).save(depositRow()),
      db.getRepository(WalletTransaction).save({
        ...depositRow(),
        user_id: destination.user_id,
        source_wallet_id: destination.id,
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({
      code: '23505',
      constraint: SUCCESSFUL_DEPOSIT_UNIQUE_INDEX,
    });
    expect(await db.getRepository(WalletTransaction).count()).toBe(1);
  });

  it('allows pending and failed attempts but prevents a second successful promotion', async () => {
    const repository = db.getRepository(WalletTransaction);
    const pending = await repository.save({
      ...depositRow(),
      transaction_status: TransactionStatus.PENDING,
    });
    await repository.save({
      ...depositRow(),
      transaction_status: TransactionStatus.FAILED,
    });
    await repository.save(depositRow());
    await expect(
      repository.update(pending.id, {
        transaction_status: TransactionStatus.SUCCESSFUL,
      }),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: SUCCESSFUL_DEPOSIT_UNIQUE_INDEX,
    });
    expect(
      (await repository.findOneByOrFail({ id: pending.id })).transaction_status,
    ).toBe(TransactionStatus.PENDING);
  });

  it('allows one valid pending-to-successful transition and then freezes that record', async () => {
    const repository = db.getRepository(WalletTransaction);
    const pending = await repository.save({
      ...depositRow(),
      transaction_status: TransactionStatus.PENDING,
    });
    await repository.update(pending.id, {
      transaction_status: TransactionStatus.SUCCESSFUL,
    });
    await expect(
      repository.update(pending.id, { reference: 'new-reference' }),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'wallet_transactions_successful_immutable',
    });
  });

  it('prevents successful ledger edits, status reversal, and deletion', async () => {
    const repository = db.getRepository(WalletTransaction);
    const success = await repository.save(depositRow());
    const before = await repository.findOneByOrFail({ id: success.id });
    for (const change of [
      { amount: 2000 },
      { reference: 'changed' },
      { transaction_status: TransactionStatus.PENDING },
    ]) {
      await expect(repository.update(success.id, change)).rejects.toMatchObject(
        {
          code: '23514',
          constraint: 'wallet_transactions_successful_immutable',
        },
      );
    }
    await expect(repository.delete(success.id)).rejects.toMatchObject({
      code: '23514',
      constraint: 'wallet_transactions_successful_immutable',
    });
    expect(await repository.findOneByOrFail({ id: success.id })).toEqual(
      before,
    );
  });

  it('rejects missing ledger wallet and user references', async () => {
    await expect(
      db
        .getRepository(WalletTransaction)
        .save({ ...depositRow(), source_wallet_id: randomUUID() }),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'wallet_transactions_wallet_fk',
    });
    await expect(
      db
        .getRepository(WalletTransaction)
        .save({ ...depositRow(), user_id: randomUUID() }),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'wallet_transactions_user_fk',
    });
  });

  it('rejects missing transfer wallets and audit users', async () => {
    for (const [change, constraint] of [
      [{ source_wallet_id: randomUUID() }, 'transfers_source_wallet_fk'],
      [
        { destination_wallet_id: randomUUID() },
        'transfers_destination_wallet_fk',
      ],
      [{ requested_by: randomUUID() }, 'transfers_requester_fk'],
      [{ reviewed_by: randomUUID() }, 'transfers_reviewer_fk'],
    ] as const) {
      await expect(
        db.getRepository(Transfer).save({ ...transferRow(), ...change }),
      ).rejects.toMatchObject({ code: '23503', constraint });
    }
  });

  it('rejects self transfers in the database', async () => {
    await expect(
      db
        .getRepository(Transfer)
        .save({ ...transferRow(), destination_wallet_id: source.id }),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'transfers_wallets_distinct',
    });
  });

  it('blocks hard deletion of wallets referenced by transfers or ledger history', async () => {
    await db.getRepository(Transfer).save(transferRow());
    await expect(
      db.getRepository(Wallet).delete(destination.id),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'transfers_destination_wallet_fk',
    });
    await db.getRepository(Transfer).delete({ source_wallet_id: source.id });
    await db.getRepository(WalletTransaction).save(depositRow());
    await expect(
      db.getRepository(Wallet).delete(source.id),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'wallet_transactions_wallet_fk',
    });
    await db.getRepository(Wallet).softDelete(source.id);
    expect(await db.getRepository(WalletTransaction).count()).toBe(1);
  });

  it('rolls back credit when the unique index catches a replay missed by the precheck', async () => {
    const service = app.get(WalletsService);
    verifiedPayment('replay');
    await service.deposit('replay', owner.id);
    const original = EntityManager.prototype.findOne;
    const precheck = jest
      .spyOn(EntityManager.prototype, 'findOne')
      .mockImplementation(function (
        this: EntityManager,
        entity: any,
        options: any,
      ): Promise<any> {
        return entity === WalletTransaction
          ? Promise.resolve(null)
          : original.call(this, entity, options);
      });
    try {
      await expect(service.deposit('replay', owner.id)).rejects.toMatchObject({
        status: 409,
      });
    } finally {
      precheck.mockRestore();
    }
    expect(
      Number(
        (await db.getRepository(Wallet).findOneByOrFail({ id: source.id }))
          .kobo_balance,
      ),
    ).toBe(6000);
    expect(await db.getRepository(WalletTransaction).count()).toBe(1);
  });

  it('credits the maximum safe balance without losing display cents', async () => {
    await db.query(
      'UPDATE wallets SET kobo_balance = $1::numeric, balance = $1::numeric / 100 WHERE id = $2',
      [String(Number.MAX_SAFE_INTEGER - 1000), source.id],
    );
    verifiedPayment('maximum-balance');
    await app.get(WalletsService).deposit('maximum-balance', owner.id);
    const wallet = await db
      .getRepository(Wallet)
      .findOneByOrFail({ id: source.id });
    expect(String(wallet.kobo_balance)).toBe('9007199254740991');
    expect(wallet.balance).toBe('90071992547409.91');
  });
});
