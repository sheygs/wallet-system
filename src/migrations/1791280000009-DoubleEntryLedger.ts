import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoubleEntryLedger1791280000009 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      'LOCK TABLE wallets, wallet_transactions, transfers IN SHARE ROW EXCLUSIVE MODE',
    );

    await runner.query(`CREATE TABLE ledger_journals (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), reference text NOT NULL UNIQUE,
      kind text NOT NULL CHECK (kind IN ('opening','deposit','transfer','correction')),
      currency wallets_currency_enum NOT NULL, reason text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);

    await runner.query(`CREATE TABLE ledger_entries (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), journal_id uuid NOT NULL REFERENCES ledger_journals(id),
      wallet_id uuid REFERENCES wallets(id), account text NOT NULL,
      amount numeric NOT NULL CHECK ((amount <> 0 AND abs(amount) <= 9007199254740991 AND amount = trunc(amount)) IS TRUE),
      UNIQUE (journal_id, account),
      CHECK (wallet_id IS NULL OR account = 'wallet:' || wallet_id::text)
    )`);

    await runner.query(
      'CREATE INDEX ledger_entries_wallet_idx ON ledger_entries(wallet_id)',
    );

    await runner.query(`CREATE FUNCTION protect_ledger_record() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Ledger records are immutable; use a compensating correction' USING ERRCODE = '23514'; END $$`);

    for (const table of ['ledger_journals', 'ledger_entries']) {
      await runner.query(
        `CREATE TRIGGER ${table}_immutable BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION protect_ledger_record()`,
      );
    }

    await runner.query(`CREATE FUNCTION validate_ledger_journal() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE journal uuid; entry_count integer; total numeric; wallet_currency wallets_currency_enum;
      BEGIN
        IF TG_TABLE_NAME = 'ledger_journals' THEN journal := NEW.id; ELSE journal := NEW.journal_id; END IF;
        SELECT COUNT(*), SUM(amount) INTO entry_count, total FROM ledger_entries WHERE journal_id = journal;
        IF entry_count <> 2 OR total <> 0 THEN
          RAISE EXCEPTION 'Journal must contain two balanced entries' USING ERRCODE = '23514';
        END IF;
        IF EXISTS (SELECT 1 FROM ledger_entries e JOIN wallets w ON w.id = e.wallet_id
          JOIN ledger_journals j ON j.id = e.journal_id WHERE e.journal_id = journal AND w.currency <> j.currency) THEN
          RAISE EXCEPTION 'Ledger wallet currency mismatch' USING ERRCODE = '23514';
        END IF;
        RETURN NULL;
      END $$`);

    await runner.query(`CREATE CONSTRAINT TRIGGER ledger_journal_balanced AFTER INSERT ON ledger_journals
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_ledger_journal()`);

    await runner.query(`CREATE CONSTRAINT TRIGGER ledger_entries_balanced AFTER INSERT ON ledger_entries
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_ledger_journal()`);

    await runner.query(`CREATE FUNCTION record_wallet_opening() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE journal uuid;
      BEGIN
        IF NEW.kobo_balance <> 0 THEN
          INSERT INTO ledger_journals (reference, kind, currency, reason)
            VALUES ('opening:' || NEW.id, 'opening', NEW.currency, 'Opening balance checkpoint; prior history is not reconstructed') RETURNING id INTO journal;
          INSERT INTO ledger_entries (journal_id, wallet_id, account, amount) VALUES
            (journal, NEW.id, 'wallet:' || NEW.id, NEW.kobo_balance),
            (journal, NULL, 'opening:' || NEW.currency, -NEW.kobo_balance);
        END IF;
        RETURN NEW;
      END $$`);

    // Existing amounts are checkpoints, never invented historical settlements.
    await runner.query(`INSERT INTO ledger_journals (reference, kind, currency, reason)
      SELECT 'opening:' || id, 'opening', currency, 'Migration opening checkpoint; reconcile with verified statements before rollout'
      FROM wallets WHERE kobo_balance <> 0`);

    await runner.query(`INSERT INTO ledger_entries (journal_id, wallet_id, account, amount)
      SELECT j.id, w.id, 'wallet:' || w.id, w.kobo_balance FROM wallets w JOIN ledger_journals j ON j.reference = 'opening:' || w.id
      UNION ALL SELECT j.id, NULL, 'opening:' || w.currency, -w.kobo_balance FROM wallets w JOIN ledger_journals j ON j.reference = 'opening:' || w.id`);

    await runner.query(
      `CREATE TRIGGER wallet_opening AFTER INSERT ON wallets FOR EACH ROW EXECUTE FUNCTION record_wallet_opening()`,
    );

    await runner.query(`CREATE FUNCTION prevent_wallet_currency_change() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.currency IS DISTINCT FROM OLD.currency THEN
        RAISE EXCEPTION 'Wallet currency is immutable' USING ERRCODE = '23514';
      END IF; RETURN NEW; END $$`);

    await runner.query(
      `CREATE TRIGGER wallet_currency_immutable BEFORE UPDATE OF currency ON wallets FOR EACH ROW EXECUTE FUNCTION prevent_wallet_currency_change()`,
    );

    await runner.query(`CREATE FUNCTION record_successful_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE journal uuid; wallet_currency wallets_currency_enum; settlement transfers%ROWTYPE;
      BEGIN
        IF NEW.transaction_status <> 'successful' THEN RETURN NEW; END IF;
        SELECT currency INTO STRICT wallet_currency FROM wallets WHERE id = NEW.source_wallet_id;
        IF NEW.transaction_type = 'DEPOSIT' THEN
          INSERT INTO ledger_journals (reference, kind, currency, reason)
            VALUES ('deposit:' || NEW.reference, 'deposit', wallet_currency, 'Verified provider deposit') RETURNING id INTO journal;
          INSERT INTO ledger_entries (journal_id, wallet_id, account, amount) VALUES
            (journal, NEW.source_wallet_id, 'wallet:' || NEW.source_wallet_id, NEW.amount),
            (journal, NULL, 'external:' || wallet_currency, -NEW.amount);
        ELSE
          IF NEW.reference IS NULL OR NEW.reference !~ '^transfer:[0-9a-fA-F-]{36}$' THEN
            RAISE EXCEPTION 'Successful transfer requires an individual settlement reference' USING ERRCODE = '23514';
          END IF;
          SELECT * INTO STRICT settlement FROM transfers WHERE id = substring(NEW.reference FROM 10)::uuid;
          IF settlement.source_wallet_id <> NEW.source_wallet_id OR settlement.transferred_amount <> NEW.amount
            OR settlement.currency::text IS DISTINCT FROM wallet_currency::text THEN
            RAISE EXCEPTION 'Transfer settlement does not match ledger' USING ERRCODE = '23514';
          END IF;
          INSERT INTO ledger_journals (reference, kind, currency, reason)
            VALUES (NEW.reference, 'transfer', wallet_currency, 'Wallet transfer settlement') RETURNING id INTO journal;
          INSERT INTO ledger_entries (journal_id, wallet_id, account, amount) VALUES
            (journal, settlement.source_wallet_id, 'wallet:' || settlement.source_wallet_id, -NEW.amount),
            (journal, settlement.destination_wallet_id, 'wallet:' || settlement.destination_wallet_id, NEW.amount);
        END IF;
        RETURN NEW;
      END $$`);

    await runner.query(`CREATE TRIGGER wallet_transaction_double_entry AFTER INSERT OR UPDATE OF transaction_status ON wallet_transactions
      FOR EACH ROW EXECUTE FUNCTION record_successful_settlement()`);

    await runner.query(`CREATE FUNCTION post_wallet_correction(wallet uuid, delta numeric, correction_reference text, explanation text)
      RETURNS uuid LANGUAGE plpgsql AS $$
      DECLARE journal uuid; wallet_currency wallets_currency_enum;
      BEGIN
        IF explanation IS NULL OR length(trim(explanation)) < 10 OR correction_reference IS NULL OR length(trim(correction_reference)) = 0 THEN
          RAISE EXCEPTION 'Correction requires a unique reference and audit explanation' USING ERRCODE = '23514';
        END IF;
        SELECT currency INTO STRICT wallet_currency FROM wallets WHERE id = wallet FOR UPDATE;
        INSERT INTO ledger_journals (reference, kind, currency, reason)
          VALUES ('correction:' || correction_reference, 'correction', wallet_currency, explanation) RETURNING id INTO journal;
        INSERT INTO ledger_entries (journal_id, wallet_id, account, amount) VALUES
          (journal, wallet, 'wallet:' || wallet, delta), (journal, NULL, 'correction:' || wallet_currency, -delta);
        UPDATE wallets SET kobo_balance = kobo_balance + delta, updated_at = now() WHERE id = wallet;
        RETURN journal;
      END $$`);

    await runner.query(
      'REVOKE ALL ON FUNCTION post_wallet_correction(uuid, numeric, text, text) FROM PUBLIC',
    );

    await runner.query(`CREATE VIEW wallet_balance_reconciliation AS
      SELECT w.id AS wallet_id, w.currency, w.kobo_balance AS stored_balance,
        COALESCE(SUM(e.amount), 0) AS ledger_balance,
        w.kobo_balance - COALESCE(SUM(e.amount), 0) AS difference
      FROM wallets w LEFT JOIN ledger_entries e ON e.wallet_id = w.id GROUP BY w.id`);
  }
  async down(): Promise<void> {
    throw new Error(
      'Ledger rollback requires a reviewed reconciliation and data-preserving migration',
    );
  }
}
