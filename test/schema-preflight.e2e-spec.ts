import { DataSource, QueryRunner } from 'typeorm';
import { dataSource } from '../src/ormconfig';
import { InitializeSchema1791280000000 } from '../src/migrations/1791280000000-InitializeSchema';
import { schemaPreflight } from '../src/database/schema-preflight';

// A separate fixture schema exercises adoption without touching application data.
describe('Existing schema adoption preflight', () => {
  let db: DataSource, runner: QueryRunner;
  beforeAll(async () => {
    db = await new DataSource({
      ...dataSource,
      migrationsRun: false,
      entities: [],
    }).initialize();
    runner = db.createQueryRunner();
    await runner.connect();
  });
  beforeEach(async () => {
    await runner.query('CREATE SCHEMA security_preflight_test');
    await runner.startTransaction();
    await runner.query('SET search_path TO security_preflight_test, public');
    await new InitializeSchema1791280000000().up(runner);
  });
  afterEach(async () => {
    await runner.rollbackTransaction();
    await runner.query('SET search_path TO public');
    await runner.query('DROP SCHEMA security_preflight_test CASCADE');
  });
  afterAll(async () => {
    await runner.release();
    await db.destroy();
  });
  it('accepts a correctly shaped existing schema without changing records', async () => {
    const before = await runner.query('SELECT * FROM wallets');
    await schemaPreflight(runner);
    expect(await runner.query('SELECT * FROM wallets')).toEqual(before);
  });
  it.each([
    ['ALTER TABLE users DROP COLUMN phone_number', 'users.phone_number'],
    [
      'ALTER TABLE wallets ALTER COLUMN kobo_balance TYPE varchar USING kobo_balance::text',
      'wallets.kobo_balance',
    ],
    [
      'ALTER TABLE wallet_transactions ALTER COLUMN amount DROP NOT NULL',
      'wallet_transactions.amount',
    ],
    ['ALTER TABLE users DROP CONSTRAINT users_email_key', 'unique index'],
    ['ALTER TABLE wallets DROP CONSTRAINT wallets_user_id_fkey', 'foreign key'],
  ])('refuses incompatible shape %s', async (sql, finding) => {
    await runner.query(sql);
    await expect(
      new InitializeSchema1791280000000().up(runner),
    ).rejects.toThrow(finding);
  });
});
