import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { WalletsService } from '../src/wallets/wallets.service';
import { User } from '../src/users/user.entity';
import { Currency, Wallet } from '../src/wallets/wallet.entity';
import { Transfer } from '../src/transfers/transfer.entity';
import { TransferStatus } from '../src/interface/types';
import { TransferRequest } from '../src/transfers/transfer-request.entity';
import { WalletTransaction } from '../src/wallet-transactions/wallet-transaction.entity';

describe('Transfer request retries (PostgreSQL)', () => {
  let app: INestApplication;
  let db: DataSource;
  let service: WalletsService;
  let owner: User;
  let recipient: User;
  let source: Wallet;
  let destination: Wallet;
  let token: string;
  const originalThreshold = process.env.MININUM_APPROVAL_AMOUNT;
  beforeAll(async () => {
    process.env.MININUM_APPROVAL_AMOUNT = '1000';
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
      email: 'retry-owner@example.com',
      password: 'unused-fixture-hash',
    });
    recipient = await db.getRepository(User).save({
      first_name: 'Test',
      last_name: 'Recipient',
      email: 'retry-recipient@example.com',
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
    token = app.get(JwtService).sign({ authVersion: 0, userId: owner.id });
  });
  afterEach(async () => {
    // Only a disposable, privileged test database may truncate protected history.
    await db.query('TRUNCATE transfer_requests');
    await db.query('TRUNCATE wallet_transactions');
    await db.query('DELETE FROM transfers');
    await db.query('TRUNCATE ledger_entries, ledger_journals');
    await db.query('DELETE FROM wallets');
    await db.query('DELETE FROM users');
    await db.query('TRUNCATE auth_rate_limits');
  });
  afterAll(async () => {
    await app.close();
    if (originalThreshold === undefined)
      delete process.env.MININUM_APPROVAL_AMOUNT;
    else process.env.MININUM_APPROVAL_AMOUNT = originalThreshold;
  });
  function body(amount = 1000) {
    return {
      source_wallet_id: source.id,
      destination_wallet_id: destination.id,
      amount,
      currency: Currency.NGN,
      reason: 'retry test',
    };
  }
  function post(key: string, payload = body(), accessToken = token) {
    return request(app.getHttpServer())
      .post('/transfers')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', key)
      .send(payload);
  }
  async function expectCounts(transfers: number, ledger: number, keys: number) {
    expect(await db.getRepository(Transfer).count()).toBe(transfers);
    expect(await db.getRepository(WalletTransaction).count()).toBe(ledger);
    expect(await db.getRepository(TransferRequest).count()).toBe(keys);
  }
  async function sourceBalance() {
    return Number(
      (await db.getRepository(Wallet).findOneByOrFail({ id: source.id }))
        .kobo_balance,
    );
  }

  it('returns the original response on sequential retries without another debit', async () => {
    const key = randomUUID();
    const first = await post(key).expect(200);
    const second = await post(key).expect(200);
    expect(second.body).toEqual(first.body);
    expect(await sourceBalance()).toBe(4000);
    await expectCounts(1, 1, 1);
  });

  it('returns the same response to concurrent retries', async () => {
    const key = randomUUID();
    const responses = await Promise.all([
      post(key).expect(200),
      post(key).expect(200),
      post(key).expect(200),
    ]);
    expect(responses[1].body).toEqual(responses[0].body);
    expect(responses[2].body).toEqual(responses[0].body);
    expect(await sourceBalance()).toBe(4000);
    await expectCounts(1, 1, 1);
  });

  it('rejects payload changes under a recorded key', async () => {
    const key = randomUUID();
    await post(key).expect(200);
    for (const changed of [
      { ...body(), amount: 2000 },
      { ...body(), reason: 'changed' },
      { ...body(), destination_wallet_id: source.id },
      { ...body(), currency: Currency.USD },
    ])
      await post(key, changed).expect(409);
    expect(await sourceBalance()).toBe(4000);
    await expectCounts(1, 1, 1);
  });

  it('resolves competing payloads under the same key to one transfer and one conflict', async () => {
    const key = randomUUID();
    const responses = await Promise.all([
      post(key, body(1000)),
      post(key, body(2000)),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const accepted = responses.find((r) => r.status === 200).body.data;
    const executed = accepted.status === TransferStatus.EXECUTED;
    expect(await sourceBalance()).toBe(executed ? 4000 : 5000);
    await expectCounts(1, executed ? 1 : 0, 1);
  });

  it('allows new keys for deliberate new transfers', async () => {
    await post(randomUUID()).expect(200);
    await post(randomUUID()).expect(200);
    expect(await sourceBalance()).toBe(3000);
    await expectCounts(2, 2, 2);
  });

  it('scopes a key to its authenticated user', async () => {
    const key = randomUUID();
    await post(key).expect(200);
    const recipientToken = app
      .get(JwtService)
      .sign({ authVersion: 0, userId: recipient.id });
    // The recipient cannot retrieve the owner's stored result with that key.
    await post(key, body(), recipientToken).expect(403);
    const reverse = {
      ...body(),
      source_wallet_id: destination.id,
      destination_wallet_id: source.id,
    };
    await post(key, reverse, recipientToken).expect(200);
    expect(await sourceBalance()).toBe(5000);
    await expectCounts(2, 2, 2);
  });

  it('requires a key before any money or request records are written', async () => {
    await request(app.getHttpServer())
      .post('/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send(body())
      .expect(400);
    await post('has spaces').expect(400);
    await post('a'.repeat(129)).expect(400);
    expect(await sourceBalance()).toBe(5000);
    await expectCounts(0, 0, 0);
  });

  it('canonicalizes UUID casing and explicit versus omitted wallet currency', async () => {
    const key = randomUUID();
    const first = await post(key, { ...body(), currency: undefined }).expect(
      200,
    );
    const retry = await post(key, {
      ...body(),
      source_wallet_id: source.id.toUpperCase(),
      destination_wallet_id: destination.id.toUpperCase(),
    }).expect(200);
    expect(retry.body).toEqual(first.body);
    await expectCounts(1, 1, 1);
  });

  it('does not reserve a key for a failed transfer and allows a later retry', async () => {
    const key = randomUUID();
    await db
      .getRepository(Wallet)
      .update(source.id, { kobo_balance: 500, balance: 5 });
    await post(key).expect(422);
    await expectCounts(0, 0, 0);
    await db
      .getRepository(Wallet)
      .update(source.id, { kobo_balance: 2000, balance: 20 });
    await post(key).expect(200);
    expect(await sourceBalance()).toBe(1000);
    await expectCounts(1, 1, 1);
  });

  it('rolls back balances, ledger, transfer and key when saving the key fails', async () => {
    await db.query(
      "ALTER TABLE transfer_requests ADD CONSTRAINT retry_test_reject_key CHECK (idempotency_key <> 'fail-key')",
    );
    try {
      await expect(
        service.transfer(body(), owner.id, 'fail-key'),
      ).rejects.toThrow();
      expect(await sourceBalance()).toBe(5000);
      await expectCounts(0, 0, 0);
    } finally {
      await db.query(
        'ALTER TABLE transfer_requests DROP CONSTRAINT retry_test_reject_key',
      );
    }
    await service.transfer(body(), owner.id, 'fail-key');
    expect(await sourceBalance()).toBe(4000);
    await expectCounts(1, 1, 1);
  });

  it.each([true, false])(
    'keeps the initial pending response after review approved=%s',
    async (approved) => {
      const key = randomUUID();
      const first = await post(key, body(2000)).expect(200);
      const admin = await db.getRepository(User).save({
        first_name: 'Test',
        last_name: 'Admin',
        email: 'retry-admin@example.com',
        password: 'unused-fixture-hash',
        is_admin: true,
      });
      await service.reviewTransfer(first.body.data.id, approved, admin.id);
      const retry = await post(key, body(2000)).expect(200);
      expect(retry.body).toEqual(first.body);
      expect(await sourceBalance()).toBe(approved ? 3000 : 5000);
      const actual = await db
        .getRepository(Transfer)
        .findOneByOrFail({ id: first.body.data.id });
      expect(actual.status).toBe(
        approved ? TransferStatus.EXECUTED : TransferStatus.REJECTED,
      );
      await expectCounts(1, approved ? 1 : 0, 1);
    },
  );

  it('replays an accepted result even after the source wallet is archived', async () => {
    const key = randomUUID();
    const first = await post(key).expect(200);
    await db.getRepository(Wallet).softDelete(source.id);
    const retry = await post(key).expect(200);
    expect(retry.body).toEqual(first.body);
    await expectCounts(1, 1, 1);
  });

  it('enforces key uniqueness and protects recorded results from edits/deletion', async () => {
    const key = randomUUID();
    await post(key).expect(200);
    const record = await db
      .getRepository(TransferRequest)
      .findOneByOrFail({ user_id: owner.id, idempotency_key: key });
    await expect(
      db.getRepository(TransferRequest).insert(record),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'transfer_requests_pkey',
    });
    await expect(
      db
        .getRepository(TransferRequest)
        .update(
          { user_id: owner.id, idempotency_key: key },
          { request_hash: 'a'.repeat(64) },
        ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'transfer_requests_immutable',
    });
    await expect(
      db
        .getRepository(TransferRequest)
        .delete({ user_id: owner.id, idempotency_key: key }),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'transfer_requests_immutable',
    });
    await expectCounts(1, 1, 1);
  });
});
