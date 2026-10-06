import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { dataSource } from '../src/ormconfig';
import { InitializeSchema1791280000000 } from '../src/migrations/1791280000000-InitializeSchema';
import { TransferApprovalLifecycle1791280000001 } from '../src/migrations/1791280000001-TransferApprovalLifecycle';
import { TransferIdempotency1791280000004 } from '../src/migrations/1791280000004-TransferIdempotency';

describe('Transfer idempotency migration (PostgreSQL)', () => {
  let db: DataSource;
  let runner: QueryRunner;
  const ownerId = randomUUID();
  const recipientId = randomUUID();
  const sourceId = randomUUID();
  const destinationId = randomUUID();
  const transferId = randomUUID();
  const migration = new TransferIdempotency1791280000004();
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
    await runner.query('CREATE SCHEMA idempotency_migration_test');
    await runner.query(
      'SET LOCAL search_path TO idempotency_migration_test, public',
    );
    await new InitializeSchema1791280000000().up(runner);
    await new TransferApprovalLifecycle1791280000001().up(runner);
    await runner.query(
      "INSERT INTO users (id, first_name, last_name, password) VALUES ($1, 'Old', 'Owner', 'unused'), ($2, 'Old', 'Recipient', 'unused')",
      [ownerId, recipientId],
    );
    await runner.query(
      'INSERT INTO wallets (id, user_id, kobo_balance, balance) VALUES ($1, $2, 5000, 50), ($3, $4, 1000, 10)',
      [sourceId, ownerId, destinationId, recipientId],
    );
    await runner.query(
      "INSERT INTO transfers (id, source_wallet_id, destination_wallet_id, transferred_amount, requested_by, status) VALUES ($1, $2, $3, 1000, $4, 'executed')",
      [transferId, sourceId, destinationId, ownerId],
    );
  });
  afterEach(async () => {
    await runner.rollbackTransaction();
    await runner.release();
  });
  afterAll(async () => {
    await db.destroy();
  });
  async function snapshot() {
    return {
      wallets: await runner.query('SELECT * FROM wallets ORDER BY id'),
      transfers: await runner.query('SELECT * FROM transfers ORDER BY id'),
    };
  }
  async function insertRecord(
    userId = ownerId,
    id = transferId,
    key = 'legacy-key',
    hash = 'a'.repeat(64),
    response: unknown = { id, requested_by: userId },
  ) {
    await runner.query(
      'INSERT INTO transfer_requests (user_id, idempotency_key, request_hash, transfer_id, response) VALUES ($1, $2, $3, $4, $5::jsonb)',
      [userId, key, hash, id, JSON.stringify(response)],
    );
  }
  it('preserves historical transfers without inventing client keys', async () => {
    const before = await snapshot();
    await migration.up(runner);
    expect(await snapshot()).toEqual(before);
    expect(await runner.query('SELECT * FROM transfer_requests')).toEqual([]);
  });
  it('can revert an unused request table without changing transfers', async () => {
    const before = await snapshot();
    await migration.up(runner);
    await migration.down(runner);
    expect(await snapshot()).toEqual(before);
    const [{ table }] = await runner.query(
      "SELECT to_regclass('idempotency_migration_test.transfer_requests') AS table",
    );
    expect(table).toBeNull();
  });
  it('refuses rollback when recorded keys would be lost', async () => {
    await migration.up(runner);
    await insertRecord();
    await expect(migration.down(runner)).rejects.toThrow(
      'Cannot remove recorded idempotency keys',
    );
    expect(
      (await runner.query('SELECT idempotency_key FROM transfer_requests'))[0]
        .idempotency_key,
    ).toBe('legacy-key');
  });
  it.each([
    ['key', 'transfer_requests_key_valid'],
    ['hash', 'transfer_requests_hash_valid'],
    ['response', 'transfer_requests_response_valid'],
  ])('rejects malformed %s data', async (field, constraint) => {
    await migration.up(runner);
    await expect(
      insertRecord(
        ownerId,
        transferId,
        field === 'key' ? '' : 'key',
        field === 'hash' ? 'invalid' : 'a'.repeat(64),
        field === 'response' ? {} : { id: transferId, requested_by: ownerId },
      ),
    ).rejects.toMatchObject({ code: '23514', constraint });
  });
  it.each([
    ['user', 'transfer_requests_user_fk'],
    ['transfer', 'transfer_requests_transfer_fk'],
  ])('rejects a missing %s reference', async (field, constraint) => {
    await migration.up(runner);
    await expect(
      insertRecord(
        field === 'user' ? randomUUID() : ownerId,
        field === 'transfer' ? randomUUID() : transferId,
      ),
    ).rejects.toMatchObject({ code: '23503', constraint });
  });
});
