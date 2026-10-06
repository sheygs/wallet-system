import { randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { Transfer } from '../src/transfers/transfer.entity';
import { TransferStatus } from '../src/interface/types';
import { InitializeSchema1791280000000 } from '../src/migrations/1791280000000-InitializeSchema';
import { TransferApprovalLifecycle1791280000001 } from '../src/migrations/1791280000001-TransferApprovalLifecycle';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { WalletsService } from '../src/wallets/wallets.service';
import { PaystackService } from '../src/utilities/paystack';
import { User } from '../src/users/user.entity';
import { Currency, Wallet } from '../src/wallets/wallet.entity';
import { WalletTransaction } from '../src/wallet-transactions/wallet-transaction.entity';

describe('Concurrent wallet operations (PostgreSQL)', () => {
  let app: INestApplication;
  let db: DataSource;
  let service: WalletsService;
  let owner: User;
  let source: Wallet;
  let destination: Wallet;
  const verifyTransaction = jest.fn();
  const originalThreshold = process.env.MININUM_APPROVAL_AMOUNT;

  beforeAll(async () => {
    process.env.MININUM_APPROVAL_AMOUNT = '1000';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PaystackService)
      .useValue({ verifyTransaction })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    db = app.get(DataSource);
    service = app.get(WalletsService);
  });

  beforeEach(async () => {
    owner = await db.getRepository(User).save({
      first_name: 'Test',
      last_name: 'Owner',
      email: 'concurrency@example.com',
      phone_number: '+2348032345346',
      password: 'unused-fixture-hash',
    });
    source = await db.getRepository(Wallet).save({
      user_id: owner.id,
      currency: Currency.NGN,
      kobo_balance: 1500,
      balance: 15,
    });
    const recipient = await db.getRepository(User).save({
      first_name: 'Test',
      last_name: 'Recipient',
      email: 'recipient@example.com',
      phone_number: '+2348032345348',
      password: 'unused-fixture-hash',
    });
    destination = await db
      .getRepository(Wallet)
      .save({ user_id: recipient.id, currency: Currency.NGN });
  });

  afterEach(async () => {
    await db.query('TRUNCATE wallet_transactions');
    await db.query('TRUNCATE transfer_requests');
    await db.query('DELETE FROM transfers');
    await db.query('DELETE FROM wallets');
    await db.query('DELETE FROM users');
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await app.close();
    if (originalThreshold === undefined)
      delete process.env.MININUM_APPROVAL_AMOUNT;
    else process.env.MININUM_APPROVAL_AMOUNT = originalThreshold;
  });

  it('serializes concurrent debits so only one succeeds', async () => {
    const body = {
      source_wallet_id: source.id,
      destination_wallet_id: destination.id,
      amount: 1000,
      currency: Currency.NGN,
      reason: '',
    };
    const results = await Promise.allSettled([
      service.transfer(body, owner.id, randomUUID()),
      service.transfer(body, owner.id, randomUUID()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const balances = await db
      .getRepository(Wallet)
      .find({ order: { id: 'ASC' } });
    expect(
      balances.map((w) => Number(w.kobo_balance)).sort((a, b) => a - b),
    ).toEqual([500, 1000]);
    expect(await db.getRepository(WalletTransaction).count()).toBe(1);
  });

  it('credits a payment exactly once when verification requests race', async () => {
    verifyTransaction.mockResolvedValue({
      status: true,
      data: {
        status: 'success',
        reference: 'concurrent-payment',
        amount: 1000,
        currency: 'NGN',
        metadata: { wallet_id: source.id, user_id: owner.id },
      },
    });
    const results = await Promise.allSettled([
      service.deposit('concurrent-payment', owner.id),
      service.deposit('concurrent-payment', owner.id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const wallet = await db
      .getRepository(Wallet)
      .findOneByOrFail({ id: source.id });
    expect(Number(wallet.kobo_balance)).toBe(2500);
    expect(await db.getRepository(WalletTransaction).count()).toBe(1);
  });

  it('rolls back balances if the ledger insert fails', async () => {
    // A temporary check constraint forces failure after balance and transfer writes.
    await db.query(
      "ALTER TABLE wallet_transactions ADD CONSTRAINT security_test_reject_transfer CHECK (transaction_type <> 'TRANSFER')",
    );
    try {
      await expect(
        service.transfer(
          {
            source_wallet_id: source.id,
            destination_wallet_id: destination.id,
            amount: 1000,
            currency: Currency.NGN,
            reason: '',
          },
          owner.id,
          randomUUID(),
        ),
      ).rejects.toThrow();
      const wallet = await db
        .getRepository(Wallet)
        .findOneByOrFail({ id: source.id });
      expect(Number(wallet.kobo_balance)).toBe(1500);
      const [{ count }] = await db.query('SELECT count(*) FROM transfers');
      expect(Number(count)).toBe(0);
    } finally {
      await db.query(
        'ALTER TABLE wallet_transactions DROP CONSTRAINT security_test_reject_transfer',
      );
    }
  });

  async function createAdmin(): Promise<User> {
    return db.getRepository(User).save({
      first_name: 'Test',
      last_name: 'Admin',
      email: 'approval-admin@example.com',
      phone_number: '+2348032345347',
      password: 'unused-fixture-hash',
      is_admin: true,
    });
  }

  async function createPending(): Promise<Transfer> {
    await db
      .getRepository(Wallet)
      .update(source.id, { kobo_balance: 5000, balance: 50 });
    return service.transfer(
      {
        source_wallet_id: source.id,
        destination_wallet_id: destination.id,
        amount: 2000,
        currency: Currency.NGN,
        reason: 'needs review',
      },
      owner.id,
      randomUUID(),
    );
  }

  async function expectBalances(
    sourceBalance: number,
    destinationBalance: number,
  ) {
    const a = await db.getRepository(Wallet).findOneByOrFail({ id: source.id });
    const b = await db
      .getRepository(Wallet)
      .findOneByOrFail({ id: destination.id });
    expect(Number(a.kobo_balance)).toBe(sourceBalance);
    expect(Number(b.kobo_balance)).toBe(destinationBalance);
  }

  it('keeps above-threshold funds available without writing a successful ledger entry', async () => {
    const pending = await createPending();
    expect(pending.status).toBe(TransferStatus.PENDING);
    expect(pending.requires_approval).toBe(true);
    expect(pending.requested_by).toBe(owner.id);
    await expectBalances(5000, 0);
    expect(await db.getRepository(WalletTransaction).count()).toBe(0);
    // Pending requests do not reserve funds: an ordinary transfer can still spend them.
    await service.transfer(
      {
        source_wallet_id: source.id,
        destination_wallet_id: destination.id,
        amount: 1000,
        currency: Currency.NGN,
        reason: '',
      },
      owner.id,
      randomUUID(),
    );
    await expectBalances(4000, 1000);
  });

  it('executes a transfer at the threshold immediately', async () => {
    const transfer = await service.transfer(
      {
        source_wallet_id: source.id,
        destination_wallet_id: destination.id,
        amount: 1000,
        currency: Currency.NGN,
        reason: '',
      },
      owner.id,
      randomUUID(),
    );
    expect(transfer.status).toBe(TransferStatus.EXECUTED);
    expect(transfer.requires_approval).toBe(false);
    await expectBalances(500, 1000);
  });

  it('settles concurrent approval requests once and records the reviewer', async () => {
    const pending = await createPending();
    const admin = await createAdmin();
    const results = await Promise.allSettled([
      service.reviewTransfer(pending.id, true, admin.id),
      service.reviewTransfer(pending.id, true, admin.id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const transfer = await db
      .getRepository(Transfer)
      .findOneByOrFail({ id: pending.id });
    expect(transfer.status).toBe(TransferStatus.EXECUTED);
    expect(transfer.approved).toBe(true);
    expect(transfer.reviewed_by).toBe(admin.id);
    expect(transfer.reviewed_at).toBeInstanceOf(Date);
    await expectBalances(3000, 2000);
    expect(await db.getRepository(WalletTransaction).count()).toBe(1);
    await expect(
      service.reviewTransfer(pending.id, false, admin.id),
    ).rejects.toMatchObject({ status: 409 });
    await expectBalances(3000, 2000);
  });

  it('rejects without moving funds and cannot later approve the same request', async () => {
    const pending = await createPending();
    const admin = await createAdmin();
    const rejected = await service.reviewTransfer(pending.id, false, admin.id);
    expect(rejected.status).toBe(TransferStatus.REJECTED);
    expect(rejected.reviewed_by).toBe(admin.id);
    await expect(
      service.reviewTransfer(pending.id, true, admin.id),
    ).rejects.toMatchObject({ status: 409 });
    await expectBalances(5000, 0);
    expect(await db.getRepository(WalletTransaction).count()).toBe(0);
  });

  it('rechecks funds at approval and leaves an insufficient request pending', async () => {
    const pending = await createPending();
    const admin = await createAdmin();
    await db
      .getRepository(Wallet)
      .update(source.id, { kobo_balance: 1000, balance: 10 });
    await expect(
      service.reviewTransfer(pending.id, true, admin.id),
    ).rejects.toMatchObject({ status: 422 });
    const unchanged = await db
      .getRepository(Transfer)
      .findOneByOrFail({ id: pending.id });
    expect(unchanged.status).toBe(TransferStatus.PENDING);
    expect(unchanged.reviewed_by).toBeNull();
    await expectBalances(1000, 0);
    expect(await db.getRepository(WalletTransaction).count()).toBe(0);
    // A rejection remains possible even when there are no longer enough funds.
    expect(
      (await service.reviewTransfer(pending.id, false, admin.id)).status,
    ).toBe(TransferStatus.REJECTED);
  });

  it('revalidates wallet currency when approving', async () => {
    const pending = await createPending();
    const admin = await createAdmin();
    await db
      .getRepository(Wallet)
      .update(destination.id, { currency: Currency.USD });
    await expect(
      service.reviewTransfer(pending.id, true, admin.id),
    ).rejects.toMatchObject({ status: 422 });
    await expectBalances(5000, 0);
  });

  it('rolls back an approval and its audit fields when ledger insertion fails', async () => {
    const pending = await createPending();
    const admin = await createAdmin();
    await db.query(
      "ALTER TABLE wallet_transactions ADD CONSTRAINT security_test_reject_transfer CHECK (transaction_type <> 'TRANSFER')",
    );
    try {
      await expect(
        service.reviewTransfer(pending.id, true, admin.id),
      ).rejects.toThrow();
      const transfer = await db
        .getRepository(Transfer)
        .findOneByOrFail({ id: pending.id });
      expect(transfer.status).toBe(TransferStatus.PENDING);
      expect(transfer.approved).toBe(false);
      expect(transfer.reviewed_at).toBeNull();
      await expectBalances(5000, 0);
      expect(await db.getRepository(WalletTransaction).count()).toBe(0);
    } finally {
      await db.query(
        'ALTER TABLE wallet_transactions DROP CONSTRAINT security_test_reject_transfer',
      );
    }
  });

  it('rejects non-admin approval at both the API and service', async () => {
    const pending = await createPending();
    const token = app.get(JwtService).sign({ userId: owner.id, isAdmin: true });
    // Even a token claiming admin rights uses the current database role.
    await request(app.getHttpServer())
      .patch(`/transfers/${pending.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approved: true })
      .expect(403);
    await expect(
      service.reviewTransfer(pending.id, true, owner.id),
    ).rejects.toMatchObject({ status: 403 });
    await expectBalances(5000, 0);
  });

  it('returns the executed transfer from the admin approval endpoint', async () => {
    const pending = await createPending();
    const admin = await createAdmin();
    const token = app.get(JwtService).sign({ userId: admin.id });
    const response = await request(app.getHttpServer())
      .patch(`/transfers/${pending.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approved: true })
      .expect(200);
    expect(response.body.data.status).toBe(TransferStatus.EXECUTED);
    expect(response.body.data.reviewed_by).toBe(admin.id);
    await expectBalances(3000, 2000);
  });

  it('does not allow approval of a missing request', async () => {
    const admin = await createAdmin();
    await expect(
      service.reviewTransfer(
        '00000000-0000-4000-8000-000000000000',
        true,
        admin.id,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('marks historical pending and approved transfers as executed without moving balances', async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query('CREATE SCHEMA approval_migration_test');
      await runner.query(
        'SET LOCAL search_path TO approval_migration_test, public',
      );
      await new InitializeSchema1791280000000().up(runner);
      await runner.query(
        "INSERT INTO users (id, first_name, last_name, password) VALUES ($1, 'Legacy', 'Owner', 'unused')",
        [owner.id],
      );
      await runner.query(
        'INSERT INTO wallets (id, user_id, kobo_balance, balance) VALUES ($1, $2, 3000, 30), ($3, $2, 2000, 20)',
        [source.id, owner.id, destination.id],
      );
      await runner.query(
        "INSERT INTO transfers (source_wallet_id, destination_wallet_id, transferred_amount, status) VALUES ($1, $2, 2000, 'pending'), ($1, $2, 2000, 'approved')",
        [source.id, destination.id],
      );
      await new TransferApprovalLifecycle1791280000001().up(runner);
      const transfers = await runner.query(
        'SELECT status, requires_approval, requested_by FROM transfers',
      );
      expect(transfers).toHaveLength(2);
      expect(
        transfers.every(
          (t: any) =>
            t.status === 'executed' &&
            t.requires_approval === false &&
            t.requested_by === owner.id,
        ),
      ).toBe(true);
      const balances = await runner.query(
        'SELECT kobo_balance FROM wallets ORDER BY kobo_balance',
      );
      expect(balances.map((w: any) => Number(w.kobo_balance))).toEqual([
        2000, 3000,
      ]);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('prevents concurrent approvals of different requests from overdrawing the same wallet', async () => {
    const first = await createPending();
    const second = await createPending();
    const admin = await createAdmin();
    await db
      .getRepository(Wallet)
      .update(source.id, { kobo_balance: 3000, balance: 30 });
    const results = await Promise.allSettled([
      service.reviewTransfer(first.id, true, admin.id),
      service.reviewTransfer(second.id, true, admin.id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const transfers = await db.getRepository(Transfer).find();
    expect(
      transfers.filter((t) => t.status === TransferStatus.EXECUTED),
    ).toHaveLength(1);
    expect(
      transfers.filter((t) => t.status === TransferStatus.PENDING),
    ).toHaveLength(1);
    await expectBalances(1000, 2000);
    expect(await db.getRepository(WalletTransaction).count()).toBe(1);
  });

  it('allows only one terminal decision when approval and rejection race', async () => {
    const pending = await createPending();
    const admin = await createAdmin();
    const results = await Promise.allSettled([
      service.reviewTransfer(pending.id, true, admin.id),
      service.reviewTransfer(pending.id, false, admin.id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const transfer = await db
      .getRepository(Transfer)
      .findOneByOrFail({ id: pending.id });
    expect([TransferStatus.EXECUTED, TransferStatus.REJECTED]).toContain(
      transfer.status,
    );
    const executed = transfer.status === TransferStatus.EXECUTED;
    await expectBalances(executed ? 3000 : 5000, executed ? 2000 : 0);
    expect(await db.getRepository(WalletTransaction).count()).toBe(
      executed ? 1 : 0,
    );
  });

  it('cannot debit an already executed below-threshold transfer through approval', async () => {
    const transfer = await service.transfer(
      {
        source_wallet_id: source.id,
        destination_wallet_id: destination.id,
        amount: 1000,
        currency: Currency.NGN,
        reason: '',
      },
      owner.id,
      randomUUID(),
    );
    const admin = await createAdmin();
    await expect(
      service.reviewTransfer(transfer.id, true, admin.id),
    ).rejects.toMatchObject({ status: 409 });
    await expectBalances(500, 1000);
    expect(await db.getRepository(WalletTransaction).count()).toBe(1);
  });

  it('returns a pending response for an above-threshold HTTP transfer', async () => {
    await db
      .getRepository(Wallet)
      .update(source.id, { kobo_balance: 5000, balance: 50 });
    const token = app.get(JwtService).sign({ userId: owner.id });
    const response = await request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .set('Authorization', `Bearer ${token}`)
      .send({
        source_wallet_id: source.id,
        destination_wallet_id: destination.id,
        amount: 2000,
        currency: 'NGN',
      })
      .expect(200);
    expect(response.body.message).toBe('transfer pending approval');
    expect(response.body.data.status).toBe(TransferStatus.PENDING);
    await expectBalances(5000, 0);
    expect(await db.getRepository(WalletTransaction).count()).toBe(0);
  });
});
