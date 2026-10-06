import { DataSource } from 'typeorm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JwtService } from '@nestjs/jwt';
import { dataSource } from '../src/ormconfig';
import { RuntimeDatabasePolicy } from '../src/database/runtime-policy';
import { WalletsService } from '../src/wallets/wallets.service';
import { Wallet } from '../src/wallets/wallet.entity';
import { User } from '../src/users/user.entity';
import { UsersService } from '../src/users/users.service';
import { AuthService } from '../src/auth/auth.service';
import { HashService } from '../src/hash/hash.service';
import { SharedRateLimit } from '../src/auth/shared-rate-limit';
import { PaystackService } from '../src/utilities/paystack';
import { jwtPolicy } from '../src/auth/jwt-policy';
import { ReconciliationService } from '../src/database/reconciliation.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';

// Run application operations as a real restricted login, not a mocked role.
describe('Least privilege runtime database role', () => {
  let admin: DataSource, runtime: DataSource;
  const role = 'wallet_security_runtime_test';
  const password = 'disposable-role-test-only';
  beforeAll(async () => {
    admin = await new DataSource({
      ...dataSource,
      migrationsRun: true,
    }).initialize();
    await admin.query(
      `CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`,
    );
    await admin.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    const grants = readFileSync(
      resolve(__dirname, '../scripts/database/grant-runtime.sql'),
      'utf8',
    ).replaceAll(':"runtime_role"', role);
    await admin.query(grants);
    runtime = await new DataSource({
      ...dataSource,
      username: role,
      password,
      migrationsRun: false,
    }).initialize();
  });
  afterAll(async () => {
    await runtime?.destroy();
    await admin.query(
      'TRUNCATE wallet_transactions, transfer_requests, ledger_entries, ledger_journals, auth_rate_limits',
    );
    await admin.query('DELETE FROM transfers');
    await admin.query('DELETE FROM wallets');
    await admin.query('DELETE FROM users');
    await admin.query(`DROP OWNED BY ${role}`);
    await admin.query(`DROP ROLE ${role}`);
    await admin.destroy();
  });
  it('passes production startup validation and rejects the database owner', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await new RuntimeDatabasePolicy(runtime).onModuleInit();
      await expect(
        new RuntimeDatabasePolicy(admin).onModuleInit(),
      ).rejects.toThrow('runtime database role');
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
  it('rejects privileged role membership even with NOINHERIT', async () => {
    const [{ current_user: owner }] = await admin.query('SELECT current_user');
    await admin.query(`ALTER ROLE ${role} NOINHERIT`);
    await admin.query(`GRANT "${owner}" TO ${role}`);
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(
        new RuntimeDatabasePolicy(runtime).onModuleInit(),
      ).rejects.toThrow('runtime database role');
    } finally {
      process.env.NODE_ENV = previous;
      await admin.query(`REVOKE "${owner}" FROM ${role}`);
      await admin.query(`ALTER ROLE ${role} INHERIT`);
    }
  });
  it.each([
    'TRUNCATE wallet_transactions',
    'ALTER TABLE wallets DROP CONSTRAINT wallets_balances_valid',
    'CREATE TABLE runtime_should_not_create(id integer)',
    "SELECT post_wallet_correction(NULL, 1, 'forbidden', 'Forbidden runtime correction')",
  ])('denies dangerous runtime SQL: %s', async (sql) => {
    await expect(runtime.query(sql)).rejects.toMatchObject({ code: '42501' });
  });
  it('supports signup, auth rotation/revocation, deposits and transfers with the granted privileges', async () => {
    const users = new UsersService(runtime.getRepository(User));
    const jwt = new JwtService({
      secret: process.env.JWT_SECRET,
      signOptions: jwtPolicy(),
    });
    const auth = new AuthService(
      users,
      new HashService(),
      jwt,
      runtime,
      new SharedRateLimit(runtime),
    );
    const user = await auth.signup({
      first_name: 'Role',
      last_name: 'Owner',
      email: 'runtime-owner@example.com',
      phone_number: '+2348032345346',
      password: 'runtime-secure-password',
    });
    const recipient = await auth.signup({
      first_name: 'Role',
      last_name: 'Recipient',
      email: 'runtime-recipient@example.com',
      phone_number: '+2348032345347',
      password: 'runtime-secure-password',
    });
    const paystack = { verifyTransaction: jest.fn() };
    const wallets = new WalletsService(
      runtime.getRepository(Wallet),
      paystack as unknown as PaystackService,
      runtime,
    );
    const source = await wallets.createWallet({ user_id: user.id });
    const destination = await wallets.createWallet({ user_id: recipient.id });
    await expect(
      runtime.query(
        "INSERT INTO wallets(user_id,currency,kobo_balance) VALUES ($1,'USD',1000)",
        [user.id],
      ),
    ).rejects.toMatchObject({ code: '42501' });
    paystack.verifyTransaction.mockResolvedValue({
      status: true,
      data: {
        status: 'success',
        reference: 'runtime-deposit',
        amount: 1000,
        currency: 'NGN',
        metadata: { wallet_id: source.id, user_id: user.id },
      },
    });
    await wallets.deposit('runtime-deposit', user.id);
    await wallets.transfer(
      {
        source_wallet_id: source.id,
        destination_wallet_id: destination.id,
        amount: 300,
        currency: undefined,
        reason: undefined,
      },
      user.id,
      'runtime-transfer',
    );
    await new ReconciliationService(runtime).check();
    expect(await wallets.getWalletBalance(source.id)).toBe('7.00');
    expect(await wallets.getWalletBalance(destination.id)).toBe('3.00');
    const login = await auth.login({
      email: user.email,
      password: 'runtime-secure-password',
    });
    const refresh = await auth.refresh(login.refresh_token);
    const strategy = new JwtStrategy(users);
    await strategy.validate(jwt.decode(refresh.access_token));
    await auth.logout(user.id);
    await expect(
      strategy.validate(jwt.decode(refresh.access_token)),
    ).rejects.toMatchObject({ status: 401 });
  });
});
