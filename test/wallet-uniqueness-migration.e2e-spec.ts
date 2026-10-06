import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { dataSource } from '../src/ormconfig';
import { InitializeSchema1791280000000 } from '../src/migrations/1791280000000-InitializeSchema';
import { ActiveWalletUniqueness1791280000002 } from '../src/migrations/1791280000002-ActiveWalletUniqueness';

describe('Active-wallet uniqueness migration (PostgreSQL)', () => {
  let db: DataSource;
  let runner: QueryRunner;
  const userId = randomUUID();
  const migration = new ActiveWalletUniqueness1791280000002();
  beforeAll(async () => {
    db = new DataSource({
      ...dataSource,
      entities: [],
      migrations: [],
      migrationsRun: false,
    });
    await db.initialize();
  });

  beforeEach(async () => {
    runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    await runner.query('CREATE SCHEMA wallet_uniqueness_migration_test');
    await runner.query(
      'SET LOCAL search_path TO wallet_uniqueness_migration_test, public',
    );
    await new InitializeSchema1791280000000().up(runner);
    await runner.query(
      "INSERT INTO users (id, first_name, last_name, password) VALUES ($1, 'Legacy', 'Owner', 'unused')",
      [userId],
    );
  });

  afterEach(async () => {
    await runner.rollbackTransaction();
    await runner.release();
  });
  afterAll(async () => {
    await db.destroy();
  });

  it('blocks duplicates and leaves every historical row and balance intact', async () => {
    await runner.query(
      "INSERT INTO wallets (user_id, currency, balance, kobo_balance) VALUES ($1, 'NGN', 100, 10000), ($1, 'NGN', 200, 20000)",
      [userId],
    );
    const before = await runner.query('SELECT * FROM wallets ORDER BY id');
    await expect(migration.up(runner)).rejects.toThrow(
      'Active wallet duplicates exist; reconcile them',
    );
    expect(await runner.query('SELECT * FROM wallets ORDER BY id')).toEqual(
      before,
    );
    const [{ index }] = await runner.query(
      "SELECT to_regclass('wallet_uniqueness_migration_test.wallets_active_user_currency_unique') AS index",
    );
    expect(index).toBeNull();
  });

  it('accepts distinct currencies and archived duplicates without modifying data', async () => {
    await runner.query(
      "INSERT INTO wallets (user_id, currency, balance, kobo_balance, deleted_at) VALUES ($1, 'NGN', 100, 10000, NULL), ($1, 'USD', 200, 20000, NULL), ($1, 'NGN', 300, 30000, now())",
      [userId],
    );
    const before = await runner.query('SELECT * FROM wallets ORDER BY id');
    await migration.up(runner);
    expect(await runner.query('SELECT * FROM wallets ORDER BY id')).toEqual(
      before,
    );
    const [{ definition }] = await runner.query(
      "SELECT pg_get_indexdef('wallet_uniqueness_migration_test.wallets_active_user_currency_unique'::regclass) AS definition",
    );
    expect(definition).toContain('UNIQUE INDEX');
    expect(definition).toContain('WHERE (deleted_at IS NULL)');
  });

  it('enforces the unique index after migrating a clean legacy schema', async () => {
    await runner.query(
      "INSERT INTO wallets (user_id, currency) VALUES ($1, 'NGN')",
      [userId],
    );
    await migration.up(runner);
    await expect(
      runner.query(
        "INSERT INTO wallets (user_id, currency) VALUES ($1, 'NGN')",
        [userId],
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'wallets_active_user_currency_unique',
    });
  });

  it('can revert the index without deleting wallet data', async () => {
    await runner.query(
      "INSERT INTO wallets (user_id, currency) VALUES ($1, 'NGN')",
      [userId],
    );
    await migration.up(runner);
    await migration.down(runner);
    await runner.query(
      "INSERT INTO wallets (user_id, currency) VALUES ($1, 'NGN')",
      [userId],
    );
    const [{ count }] = await runner.query('SELECT COUNT(*) FROM wallets');
    expect(Number(count)).toBe(2);
  });
});
