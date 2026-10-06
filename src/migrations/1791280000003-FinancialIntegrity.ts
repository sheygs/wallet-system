import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinancialIntegrity1791280000003 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Block writes to all participants until preflight and constraints commit.
    await queryRunner.query(
      'LOCK TABLE users, wallets, transfers, wallet_transactions IN SHARE ROW EXCLUSIVE MODE',
    );
    const invalid = await queryRunner.query(`
      SELECT * FROM (
        SELECT 'wallet_balances' AS issue, id::text AS row_id FROM wallets
        WHERE (kobo_balance >= 0 AND kobo_balance <= 9007199254740991
          AND kobo_balance = trunc(kobo_balance) AND balance >= 0 AND balance = kobo_balance / 100) IS NOT TRUE
        UNION ALL
        SELECT 'transfer_amount', id::text FROM transfers
        WHERE (transferred_amount > 0 AND transferred_amount <= 9007199254740991
          AND transferred_amount = trunc(transferred_amount)) IS NOT TRUE
        UNION ALL
        SELECT 'transfer_same_wallet', id::text FROM transfers WHERE source_wallet_id = destination_wallet_id
        UNION ALL
        SELECT 'ledger_amount', id::text FROM wallet_transactions
        WHERE (amount > 0 AND amount <= 9007199254740991 AND amount = trunc(amount)) IS NOT TRUE
        UNION ALL
        SELECT 'deposit_reference_missing', id::text FROM wallet_transactions
        WHERE transaction_type = 'DEPOSIT' AND transaction_status = 'successful'
          AND (reference IS NULL OR reference !~ '[^[:space:]]')
        UNION ALL
        SELECT 'deposit_reference_duplicate', MIN(id::text) FROM wallet_transactions
        WHERE transaction_type = 'DEPOSIT' AND transaction_status = 'successful'
        GROUP BY reference HAVING COUNT(*) > 1
        UNION ALL
        SELECT 'transfer_wallet_missing', t.id::text FROM transfers t
        LEFT JOIN wallets s ON s.id = t.source_wallet_id
        LEFT JOIN wallets d ON d.id = t.destination_wallet_id WHERE s.id IS NULL OR d.id IS NULL
        UNION ALL
        SELECT 'transfer_requester_missing', t.id::text FROM transfers t
        LEFT JOIN users u ON u.id = t.requested_by WHERE t.requested_by IS NOT NULL AND u.id IS NULL
        UNION ALL
        SELECT 'transfer_reviewer_missing', t.id::text FROM transfers t
        LEFT JOIN users u ON u.id = t.reviewed_by WHERE t.reviewed_by IS NOT NULL AND u.id IS NULL
        UNION ALL
        SELECT 'ledger_wallet_missing', t.id::text FROM wallet_transactions t
        LEFT JOIN wallets w ON w.id = t.source_wallet_id WHERE w.id IS NULL
        UNION ALL
        SELECT 'ledger_user_missing', t.id::text FROM wallet_transactions t
        LEFT JOIN users u ON u.id = t.user_id WHERE t.user_id IS NOT NULL AND u.id IS NULL
      ) invalid ORDER BY issue, row_id LIMIT 10
    `);
    if (invalid.length > 0) {
      throw new Error(
        `Financial integrity violations exist; reconcile records before migrating. Sample issues: ${JSON.stringify(invalid)}`,
      );
    }
    await queryRunner.query(`ALTER TABLE wallets ADD CONSTRAINT wallets_balances_valid
      CHECK ((kobo_balance >= 0 AND kobo_balance <= 9007199254740991
        AND kobo_balance = trunc(kobo_balance) AND balance >= 0 AND balance = kobo_balance / 100) IS TRUE)`);
    await queryRunner.query(`ALTER TABLE transfers
      ADD CONSTRAINT transfers_amount_valid CHECK ((transferred_amount > 0 AND transferred_amount <= 9007199254740991 AND transferred_amount = trunc(transferred_amount)) IS TRUE),
      ADD CONSTRAINT transfers_wallets_distinct CHECK ((source_wallet_id <> destination_wallet_id) IS TRUE),
      ADD CONSTRAINT transfers_source_wallet_fk FOREIGN KEY (source_wallet_id) REFERENCES wallets(id) ON DELETE RESTRICT,
      ADD CONSTRAINT transfers_destination_wallet_fk FOREIGN KEY (destination_wallet_id) REFERENCES wallets(id) ON DELETE RESTRICT,
      ADD CONSTRAINT transfers_requester_fk FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT,
      ADD CONSTRAINT transfers_reviewer_fk FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE wallet_transactions
      ADD CONSTRAINT wallet_transactions_amount_valid CHECK ((amount > 0 AND amount <= 9007199254740991 AND amount = trunc(amount)) IS TRUE),
      ADD CONSTRAINT wallet_transactions_deposit_reference_required CHECK (transaction_type <> 'DEPOSIT' OR transaction_status <> 'successful' OR (reference IS NOT NULL AND reference ~ '[^[:space:]]')),
      ADD CONSTRAINT wallet_transactions_wallet_fk FOREIGN KEY (source_wallet_id) REFERENCES wallets(id) ON DELETE RESTRICT,
      ADD CONSTRAINT wallet_transactions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT`);
    await queryRunner.query(`CREATE UNIQUE INDEX wallet_transactions_successful_deposit_reference_unique
      ON wallet_transactions (reference) WHERE transaction_type = 'DEPOSIT' AND transaction_status = 'successful'`);
    await queryRunner.query(`CREATE FUNCTION protect_successful_wallet_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Successful wallet transactions cannot be changed or deleted'
          USING ERRCODE = '23514', CONSTRAINT = 'wallet_transactions_successful_immutable';
      END;
    $$`);
    await queryRunner.query(`CREATE TRIGGER wallet_transactions_successful_immutable
      BEFORE UPDATE OR DELETE ON wallet_transactions FOR EACH ROW
      WHEN (OLD.transaction_status = 'successful') EXECUTE FUNCTION protect_successful_wallet_transaction()`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER wallet_transactions_successful_immutable ON wallet_transactions',
    );
    await queryRunner.query(
      'DROP FUNCTION protect_successful_wallet_transaction()',
    );
    await queryRunner.query(
      'DROP INDEX wallet_transactions_successful_deposit_reference_unique',
    );
    await queryRunner.query(`ALTER TABLE wallet_transactions
      DROP CONSTRAINT wallet_transactions_amount_valid,
      DROP CONSTRAINT wallet_transactions_deposit_reference_required,
      DROP CONSTRAINT wallet_transactions_wallet_fk,
      DROP CONSTRAINT wallet_transactions_user_fk`);
    await queryRunner.query(`ALTER TABLE transfers
      DROP CONSTRAINT transfers_amount_valid,
      DROP CONSTRAINT transfers_wallets_distinct,
      DROP CONSTRAINT transfers_source_wallet_fk,
      DROP CONSTRAINT transfers_destination_wallet_fk,
      DROP CONSTRAINT transfers_requester_fk,
      DROP CONSTRAINT transfers_reviewer_fk`);
    await queryRunner.query(
      'ALTER TABLE wallets DROP CONSTRAINT wallets_balances_valid',
    );
  }
}
