import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { sign, SignOptions } from 'jsonwebtoken';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';
import { UsersService } from '../src/users/users.service';
import { Wallet, Currency, BaseCurrency } from '../src/wallets/wallet.entity';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { jwtPolicy } from '../src/auth/jwt-policy';
import { SharedRateLimit } from '../src/auth/shared-rate-limit';
import { WalletsService } from '../src/wallets/wallets.service';
import { PaystackService } from '../src/utilities/paystack';
import { ReconciliationService } from '../src/database/reconciliation.service';
import { WalletTransactionsService } from '../src/wallet-transactions/wallet-transactions.service';

// This suite uses the same disposable database as the other integration suites.
describe('Remaining security controls (PostgreSQL)', () => {
  let app: INestApplication, db: DataSource, user: User, wallet: Wallet;
  const verifyTransaction = jest.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PaystackService)
      .useValue({ verifyTransaction })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    db = app.get(DataSource);
  });
  beforeEach(async () => {
    user = await db.getRepository(User).save({
      first_name: 'Security',
      last_name: 'Test',
      email: 'security@example.com',
      phone_number: '+2348032345346',
      password: await bcrypt.hash('security-test-password', 10),
      is_admin: true,
    });
    wallet = await app.get(WalletsService).createWallet({ user_id: user.id });
  });
  afterEach(async () => {
    await db.query(
      'TRUNCATE wallet_transactions, transfer_requests, ledger_entries, ledger_journals, auth_rate_limits',
    );
    await db.query('DELETE FROM transfers');
    await db.query('DELETE FROM wallets');
    await db.query('DELETE FROM users');
    jest.restoreAllMocks();
    verifyTransaction.mockReset();
  });
  afterAll(async () => {
    await app.close();
  });
  function token(payload: object, options?: SignOptions) {
    return sign(
      { authVersion: 0, userId: user.id, ...payload },
      process.env.JWT_SECRET,
      { ...jwtPolicy(), ...options },
    );
  }
  const balance = () =>
    request(app.getHttpServer()).get(`/wallets/${wallet.id}/balance`);
  const login = () =>
    app
      .get(AuthService)
      .login({ email: user.email, password: 'security-test-password' });

  it.each([
    { userId: undefined },
    { userId: null },
    { userId: '' },
    { userId: 'not-a-uuid' },
    { userId: {} },
    { authVersion: undefined },
    { authVersion: -1 },
    { authVersion: '0' },
  ])(
    'rejects malformed signed JWT payload before querying a user: %j',
    async (payload) => {
      const lookup = jest.spyOn(app.get(UsersService), 'getUserById');
      await balance().auth(token(payload), { type: 'bearer' }).expect(401);
      expect(lookup).not.toHaveBeenCalled();
    },
  );
  it.each([
    { issuer: 'other' },
    { audience: 'other' },
    { algorithm: 'HS384' },
    { expiresIn: -1 },
  ] as SignOptions[])('rejects the wrong JWT policy %j', async (options) => {
    await balance().auth(token({}, options), { type: 'bearer' }).expect(401);
  });
  it('requires an explicit expiration even on a correctly signed token', async () => {
    const access = sign(
      { userId: user.id, authVersion: 0 },
      process.env.JWT_SECRET,
      {
        issuer: jwtPolicy().issuer,
        audience: jwtPolicy().audience,
        algorithm: 'HS256',
      },
    );
    await balance().auth(access, { type: 'bearer' }).expect(401);
  });
  it('returns the canonical database identity and current admin role', async () => {
    const identity = await app.get(JwtStrategy).validate({
      userId: user.id.toUpperCase(),
      authVersion: 0,
      exp: Math.floor(Date.now() / 1000) + 60,
      email: 'forged@example.com',
      isAdmin: false,
    });
    expect(identity).toEqual({
      userId: user.id,
      email: user.email,
      phoneNumber: user.phone_number,
      isAdmin: true,
    });
  });
  it('rotates refresh tokens and never stores the plaintext secret', async () => {
    const initial = await login();
    const [{ token_hash }] = await db.query(
      'SELECT token_hash FROM refresh_tokens',
    );
    expect(token_hash).not.toBe(initial.refresh_token);
    expect(token_hash).toMatch(/^[0-9a-f]{64}$/);
    const result = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: initial.refresh_token })
      .expect(200);
    expect(result.body.data.refresh_token).not.toBe(initial.refresh_token);
    await balance()
      .auth(result.body.data.access_token, { type: 'bearer' })
      .expect(200);
    expect(result.body.data.refresh_expires_at).toBe(
      initial.refresh_expires_at,
    );
  });
  it('commits revocation on refresh reuse and rejects all issued access and refresh tokens', async () => {
    const initial = await login();
    const rotated = await app.get(AuthService).refresh(initial.refresh_token);
    await expect(
      app.get(AuthService).refresh(initial.refresh_token),
    ).rejects.toMatchObject({ status: 401 });
    await balance().auth(rotated.access_token, { type: 'bearer' }).expect(401);
    await expect(
      app.get(AuthService).refresh(rotated.refresh_token),
    ).rejects.toMatchObject({ status: 401 });
    const fresh = await login();
    await expect(
      app.get(AuthService).refresh(initial.refresh_token),
    ).rejects.toMatchObject({ status: 401 });
    await balance().auth(fresh.access_token, { type: 'bearer' }).expect(200);
  });
  it('allows only one concurrent refresh then revokes its family on the competing replay', async () => {
    const initial = await login();
    const results = await Promise.allSettled([
      app.get(AuthService).refresh(initial.refresh_token),
      app.get(AuthService).refresh(initial.refresh_token),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const [{ auth_version }] = await db.query(
      'SELECT auth_version FROM users WHERE id = $1',
      [user.id],
    );
    expect(auth_version).toBe(1);
  });
  it('logout revokes all sessions, including already issued JWTs', async () => {
    const initial = await login();
    await request(app.getHttpServer())
      .post('/auth/logout')
      .auth(initial.access_token, { type: 'bearer' })
      .expect(200);
    await balance().auth(initial.access_token, { type: 'bearer' }).expect(401);
    await expect(
      app.get(AuthService).refresh(initial.refresh_token),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('rejects expired refresh tokens', async () => {
    const initial = await login();
    await db.query(
      "UPDATE refresh_tokens SET expires_at = now() - interval '1 second'",
    );
    await expect(
      app.get(AuthService).refresh(initial.refresh_token),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('shares account backoff across service replicas and email/phone aliases', async () => {
    const auth = app.get(AuthService);
    for (let i = 0; i < 5; i++)
      await expect(
        auth.login({ email: user.email, password: 'incorrect' }),
      ).rejects.toMatchObject({ status: 400 });
    await expect(
      auth.login({
        phone_number: user.phone_number,
        password: 'security-test-password',
      }),
    ).rejects.toMatchObject({ status: 429 });
    const [{ hits }] = await db.query('SELECT hits FROM auth_rate_limits');
    expect(hits).toBe(6);
  });
  it('atomically shares limiter counts across instances and survives a new instance', async () => {
    const one = new SharedRateLimit(db),
      two = new SharedRateLimit(db);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        (i % 2 ? one : two).increment('shared-key', 60000, 5, 300000),
      ),
    );
    expect(results.filter((r) => !r.isBlocked)).toHaveLength(5);
    expect(
      (await new SharedRateLimit(db).increment('shared-key', 60000, 5, 300000))
        .isBlocked,
    ).toBe(true);
    await db.query(
      "UPDATE auth_rate_limits SET expires_at = now() - interval '1 second', blocked_until = now() - interval '1 second'",
    );
    expect(await two.increment('shared-key', 60000, 5, 300000)).toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
  });
  it('ignores spoofed forwarded IPs when no proxy is trusted', async () => {
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', `198.51.100.${i}`)
        .send({ email: `unknown${i}@example.com`, password: 'incorrect' })
        .expect(400);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', '198.51.100.99')
      .send({ email: 'unknown99@example.com', password: 'incorrect' })
      .expect(429);
  });
  it.each([
    [Currency.NGN, BaseCurrency.NGN],
    [Currency.USD, BaseCurrency.USD],
    [Currency.GHS, BaseCurrency.GHS],
  ])('derives the correct base unit for %s', async (currency, base) => {
    if (currency !== Currency.NGN)
      wallet = await app
        .get(WalletsService)
        .createWallet({ user_id: user.id, currency });
    const stored = await db
      .getRepository(Wallet)
      .findOneByOrFail({ id: wallet.id });
    expect(stored.base_currency).toBe(base);
    expect(stored.balance).toBe('0.00');
  });
  it('blocks currency reinterpretation and writes to derived base units', async () => {
    await expect(
      db.query("UPDATE wallets SET currency = 'USD' WHERE id = $1", [
        wallet.id,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      db.query("UPDATE wallets SET base_currency = 'CENTS' WHERE id = $1", [
        wallet.id,
      ]),
    ).rejects.toMatchObject({ code: '428C9' });
  });
  function deposit(reference = 'security-deposit', amount = 1000) {
    verifyTransaction.mockResolvedValue({
      status: true,
      data: {
        status: 'success',
        reference,
        amount,
        currency: 'NGN',
        metadata: { wallet_id: wallet.id, user_id: user.id },
      },
    });
    return app.get(WalletsService).deposit(reference, user.id);
  }
  it('records balanced deposit and transfer entries and reconciles both wallets', async () => {
    await deposit();
    const recipient = await db.getRepository(User).save({
      first_name: 'Other',
      last_name: 'User',
      email: 'other-security@example.com',
      password: 'unused',
    });
    const destination = await app
      .get(WalletsService)
      .createWallet({ user_id: recipient.id });
    const transfer = await app.get(WalletsService).transfer(
      {
        source_wallet_id: wallet.id,
        destination_wallet_id: destination.id,
        amount: 400,
        currency: Currency.NGN,
        reason: undefined,
      },
      user.id,
      'security-transfer',
    );
    const entries = await db.query(
      'SELECT e.wallet_id, e.amount FROM ledger_entries e JOIN ledger_journals j ON j.id = e.journal_id WHERE j.reference = $1 ORDER BY e.amount',
      [`transfer:${transfer.id}`],
    );
    expect(entries).toEqual([
      { wallet_id: wallet.id, amount: '-400' },
      { wallet_id: destination.id, amount: '400' },
    ]);
    await app.get(ReconciliationService).check();
    expect(
      await db.query(
        'SELECT reference FROM ledger_journals ORDER BY reference',
      ),
    ).toHaveLength(2);
  });
  it('detects a balance mutation without ledger evidence and preserves history through a compensating correction', async () => {
    await deposit();
    const before = await db.query('SELECT * FROM ledger_entries ORDER BY id');
    await db.query(
      "SELECT post_wallet_correction($1, -100, 'security-correction', 'Verified provider reversal')",
      [wallet.id],
    );
    await app.get(ReconciliationService).check();
    for (const entry of before)
      expect(
        await db.query('SELECT * FROM ledger_entries WHERE id = $1', [
          entry.id,
        ]),
      ).toEqual([entry]);
    await db.query(
      'UPDATE wallets SET kobo_balance = kobo_balance + 1 WHERE id = $1',
      [wallet.id],
    );
    await expect(app.get(ReconciliationService).check()).rejects.toThrow(
      'reconciliation failed',
    );
  });
  it('rejects unbalanced journals and immutable entry edits', async () => {
    await expect(
      db.transaction(async (manager) => {
        const [j] = await manager.query(
          "INSERT INTO ledger_journals(reference,kind,currency,reason) VALUES ('unbalanced','correction','NGN','Invalid journal') RETURNING id",
        );
        await manager.query(
          'INSERT INTO ledger_entries(journal_id,wallet_id,account,amount) VALUES ($1,$2,$3,100)',
          [j.id, wallet.id, `wallet:${wallet.id}`],
        );
      }),
    ).rejects.toMatchObject({ code: '23514' });
    await deposit();
    await expect(
      db.query('UPDATE ledger_entries SET amount = 1'),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(db.query('DELETE FROM ledger_journals')).rejects.toMatchObject(
      { code: '23514' },
    );
  });
  it('rolls back wallet credits when double-entry journaling fails', async () => {
    await db.query(
      "CREATE FUNCTION security_test_ledger_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$",
    );
    await db.query(
      'CREATE TRIGGER security_test_ledger_failure BEFORE INSERT ON ledger_entries FOR EACH ROW EXECUTE FUNCTION security_test_ledger_failure()',
    );
    try {
      await expect(deposit()).rejects.toThrow('fixture');
    } finally {
      await db.query(
        'DROP TRIGGER security_test_ledger_failure ON ledger_entries',
      );
      await db.query('DROP FUNCTION security_test_ledger_failure()');
    }
    expect(
      (await db.getRepository(Wallet).findOneByOrFail({ id: wallet.id }))
        .kobo_balance,
    ).toBe('0');
    expect(await db.query('SELECT * FROM ledger_journals')).toHaveLength(0);
    expect(await db.query('SELECT * FROM wallet_transactions')).toHaveLength(0);
  });
  it('paginates microsecond timestamps without skips, includes the final day and excludes the next day', async () => {
    for (const at of [
      '2024-03-31 23:59:59.000001',
      '2024-03-31 23:59:59.000002',
      '2024-03-31 23:59:59.000002',
      '2024-04-01 00:00:00',
    ]) {
      await db.query(
        "INSERT INTO wallet_transactions(source_wallet_id, amount, transaction_type, created_at) VALUES ($1, 100, 'TRANSFER', $2)",
        [wallet.id, at],
      );
    }
    const service = app.get(WalletTransactionsService);
    const range = { target_month: '3', target_year: '2024', limit: '1' };
    const ids: string[] = [];
    let cursor: string;
    do {
      const page = await service.getTransactionHistory({ ...range, cursor });
      ids.push(...page.items.map((item) => item.id));
      cursor = page.next_cursor;
    } while (cursor);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    const first = await service.getTransactionHistory(range);
    await expect(
      service.getTransactionHistory({
        target_month: '4',
        target_year: '2024',
        cursor: first.next_cursor,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
