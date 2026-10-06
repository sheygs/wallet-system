// Disposable logical-restore rehearsal. Build first; never point this at a real
// deployment. pg_dump/pg_restore transport is performed by the caller.
const { readFileSync, writeFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
process.env.NODE_ENV = 'test';
const database = process.env.REHEARSAL_POSTGRES_DB;
if (!database?.startsWith('wallet_security_rehearsal_'))
  throw new Error(
    'A wallet_security_rehearsal_* disposable database is required',
  );
const { dataSource } = require('../../dist/ormconfig');
const snapshotFile = process.env.REHEARSAL_SNAPSHOT_FILE;
if (!snapshotFile) throw new Error('REHEARSAL_SNAPSHOT_FILE is required');
const mode = process.argv[2];
const oldMigrations = [
  ['1715848668028-CreateUserTable', 'CreateUserTable1715848668028'],
  ['1791280000000-InitializeSchema', 'InitializeSchema1791280000000'],
  [
    '1791280000001-TransferApprovalLifecycle',
    'TransferApprovalLifecycle1791280000001',
  ],
  [
    '1791280000002-ActiveWalletUniqueness',
    'ActiveWalletUniqueness1791280000002',
  ],
  ['1791280000003-FinancialIntegrity', 'FinancialIntegrity1791280000003'],
  ['1791280000004-TransferIdempotency', 'TransferIdempotency1791280000004'],
].map(([file, name]) => require(`../../dist/migrations/${file}`)[name]);
async function snapshot(db) {
  return {
    users: await db.query(
      'SELECT id, email, is_admin, created_at FROM users ORDER BY id',
    ),
    wallets: await db.query(
      'SELECT id, user_id, currency, kobo_balance, created_at, deleted_at FROM wallets ORDER BY id',
    ),
    transfers: await db.query('SELECT * FROM transfers ORDER BY id'),
    history: await db.query('SELECT * FROM wallet_transactions ORDER BY id'),
    requests: await db.query(
      'SELECT * FROM transfer_requests ORDER BY user_id, idempotency_key',
    ),
  };
}
(async () => {
  if (!['prepare', 'upgrade'].includes(mode))
    throw new Error('Use prepare or upgrade');
  const db = await new DataSource({
    ...dataSource,
    database,
    migrationsRun: false,
    ...(mode === 'prepare' && { migrations: oldMigrations }),
  }).initialize();
  try {
    if (mode === 'prepare') {
      const [existing] = await db.query(
        "SELECT to_regclass('public.users') AS users",
      );
      if (existing.users)
        throw new Error('Prepare requires an empty disposable database');
      await db.runMigrations();
      await db.query(`INSERT INTO users(id,first_name,last_name,email,password) VALUES
        ('10000000-0000-4000-8000-000000000001','Legacy','Owner','legacy-owner@example.com','unused-fixture-hash'),
        ('10000000-0000-4000-8000-000000000002','Legacy','Recipient','legacy-recipient@example.com','unused-fixture-hash')`);
      await db.query(`INSERT INTO wallets(id,user_id,currency,kobo_balance,balance) VALUES
        ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','NGN',5000,50),
        ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','NGN',1000,10),
        ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','USD',1234,12.34)`);
      await db.query(`INSERT INTO transfers(id,source_wallet_id,destination_wallet_id,transferred_amount,status,requested_by)
        VALUES ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',1000,'executed','10000000-0000-4000-8000-000000000001')`);
      await db.query(`INSERT INTO wallet_transactions(user_id,source_wallet_id,amount,reference,transaction_type,transaction_status)
        VALUES ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1000,'ambiguous-legacy-reference','TRANSFER','successful')`);
      writeFileSync(snapshotFile, JSON.stringify(await snapshot(db), null, 2));
      console.log(
        'Legacy fixture prepared: 2 users, 3 wallets, 1 settled transfer and its unchanged ambiguous history',
      );
    } else {
      const expected = JSON.parse(readFileSync(snapshotFile, 'utf8'));
      assert.deepEqual(
        JSON.parse(JSON.stringify(await snapshot(db))),
        expected,
        'Restore must preserve records before upgrade',
      );
      await db.runMigrations();
      assert.deepEqual(
        JSON.parse(JSON.stringify(await snapshot(db))),
        expected,
        'Upgrade must preserve financial records',
      );
      assert.deepEqual(
        await db.query(
          'SELECT wallet_id FROM wallet_balance_reconciliation WHERE difference <> 0',
        ),
        [],
      );
      assert.deepEqual(
        await db.query(
          "SELECT id FROM ledger_journals WHERE kind <> 'opening'",
        ),
        [],
      );
      const [usd] = await db.query(
        "SELECT base_currency FROM wallets WHERE currency = 'USD'",
      );
      assert.equal(usd.base_currency, 'CENTS');
      assert.equal(await db.showMigrations(), false);
      console.log(
        'Logical restore and upgrade verified: records preserved, opening checkpoints reconcile, USD base unit corrected, no pending migrations',
      );
    }
  } finally {
    await db.destroy();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
