import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { dataSource } from '../src/ormconfig';
import { InitializeSchema1791280000000 } from '../src/migrations/1791280000000-InitializeSchema';
import { TransferApprovalLifecycle1791280000001 } from '../src/migrations/1791280000001-TransferApprovalLifecycle';
import { FinancialIntegrity1791280000003 } from '../src/migrations/1791280000003-FinancialIntegrity';

describe('Financial integrity migration (PostgreSQL)', () => {
  let db: DataSource;
  let runner: QueryRunner;
  const ownerId = randomUUID();
  const recipientId = randomUUID();
  const sourceId = randomUUID();
  const destinationId = randomUUID();
  const migration = new FinancialIntegrity1791280000003();

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
    await runner.query('CREATE SCHEMA financial_migration_test');
    await runner.query(
      'SET LOCAL search_path TO financial_migration_test, public',
    );
    await new InitializeSchema1791280000000().up(runner);
    await new TransferApprovalLifecycle1791280000001().up(runner);
    await runner.query(
      "INSERT INTO users (id, first_name, last_name, password) VALUES ($1, 'Legacy', 'Owner', 'unused'), ($2, 'Legacy', 'Recipient', 'unused')",
      [ownerId, recipientId],
    );
    await runner.query(
      'INSERT INTO wallets (id, user_id, kobo_balance, balance) VALUES ($1, $2, 5000, 50), ($3, $4, 0, 0)',
      [sourceId, ownerId, destinationId, recipientId],
    );
  });

  afterEach(async () => {
    await runner.rollbackTransaction();
    await runner.release();
  });

  afterAll(async () => {
    await db.destroy();
  });

  async function ledger(
    reference: string | null = 'paid',
    amount = '1000',
    walletId = sourceId,
    userId: string | null = ownerId,
  ) {
    await runner.query(
      "INSERT INTO wallet_transactions (user_id, source_wallet_id, amount, reference, transaction_type, transaction_status) VALUES ($1, $2, $3, $4, 'DEPOSIT', 'successful')",
      [userId, walletId, amount, reference],
    );
  }
  async function transfer(
    amount = '1000',
    source = sourceId,
    destination = destinationId,
    requester: string | null = ownerId,
    reviewer: string | null = null,
  ) {
    await runner.query(
      'INSERT INTO transfers (source_wallet_id, destination_wallet_id, transferred_amount, requested_by, reviewed_by) VALUES ($1, $2, $3, $4, $5)',
      [source, destination, amount, requester, reviewer],
    );
  }

  async function snapshot() {
    const rows: Record<string, unknown> = {};
    for (const table of [
      'users',
      'wallets',
      'transfers',
      'wallet_transactions',
    ])
      rows[table] = await runner.query(`SELECT * FROM ${table} ORDER BY id`);
    return rows;
  }

  it.each([
    [
      'wallet_balances',
      async () => {
        await runner.query('UPDATE wallets SET balance = 51 WHERE id = $1', [
          sourceId,
        ]);
      },
    ],
    [
      'wallet_balances',
      async () => {
        await runner.query(
          'UPDATE wallets SET kobo_balance = -100, balance = -1 WHERE id = $1',
          [sourceId],
        );
      },
    ],
    [
      'transfer_amount',
      async () => {
        await transfer('-1');
      },
    ],
    [
      'transfer_same_wallet',
      async () => {
        await transfer('1000', sourceId, sourceId);
      },
    ],
    [
      'ledger_amount',
      async () => {
        await ledger('paid', '1000.5');
      },
    ],
    [
      'deposit_reference_missing',
      async () => {
        await ledger(null);
      },
    ],
    [
      'deposit_reference_missing',
      async () => {
        await ledger(' \t\n');
      },
    ],
    [
      'deposit_reference_duplicate',
      async () => {
        await ledger();
        await ledger();
      },
    ],
    [
      'transfer_wallet_missing',
      async () => {
        await transfer('1000', randomUUID());
      },
    ],
    [
      'transfer_requester_missing',
      async () => {
        await transfer('1000', sourceId, destinationId, randomUUID());
      },
    ],
    [
      'transfer_reviewer_missing',
      async () => {
        await transfer('1000', sourceId, destinationId, ownerId, randomUUID());
      },
    ],
    [
      'ledger_wallet_missing',
      async () => {
        await ledger('paid', '1000', randomUUID());
      },
    ],
    [
      'ledger_user_missing',
      async () => {
        await ledger('paid', '1000', sourceId, randomUUID());
      },
    ],
  ] as Array<[string, () => Promise<void>]>)(
    'stops on %s without modifying financial records',
    async (issue, seed) => {
      await seed();
      const before = await snapshot();
      await expect(migration.up(runner)).rejects.toThrow(issue);
      expect(await snapshot()).toEqual(before);
      const [{ index }] = await runner.query(
        "SELECT to_regclass('financial_migration_test.wallet_transactions_successful_deposit_reference_unique') AS index",
      );
      expect(index).toBeNull();
    },
  );

  it('adopts valid legacy rows without inventing missing user identities or modifying balances', async () => {
    await ledger('legacy-paid', '1000', sourceId, null);
    await transfer('1000', sourceId, destinationId, null);
    const before = await snapshot();
    await migration.up(runner);
    expect(await snapshot()).toEqual(before);
    // Existing successful records become protected too.
    await expect(
      runner.query(
        "DELETE FROM wallet_transactions WHERE reference = 'legacy-paid'",
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'wallet_transactions_successful_immutable',
    });
  });

  it('reverts safeguards without altering existing records', async () => {
    await ledger();
    await transfer();
    const before = await snapshot();
    await migration.up(runner);
    await migration.down(runner);
    expect(await snapshot()).toEqual(before);
    await runner.query(
      "UPDATE wallet_transactions SET reference = 'after-rollback'",
    );
    expect(
      (await runner.query('SELECT reference FROM wallet_transactions'))[0]
        .reference,
    ).toBe('after-rollback');
  });
  it('rejects null balances even when an adopted legacy column was nullable', async () => {
    await runner.query(
      'ALTER TABLE wallets ALTER COLUMN kobo_balance DROP NOT NULL',
    );
    await migration.up(runner);
    await expect(
      runner.query('UPDATE wallets SET kobo_balance = NULL WHERE id = $1', [
        sourceId,
      ]),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'wallets_balances_valid',
    });
  });
});
