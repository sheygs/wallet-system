import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthoritativeBalance1791280000008 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('LOCK TABLE wallets IN SHARE ROW EXCLUSIVE MODE');
    const invalid = await runner.query(`SELECT id FROM wallets WHERE
      (kobo_balance >= 0 AND kobo_balance <= 9007199254740991 AND kobo_balance = trunc(kobo_balance)
       AND balance = kobo_balance / 100 AND currency IS NOT NULL) IS NOT TRUE LIMIT 10`);

    if (invalid.length)
      throw new Error(
        `Balance preflight failed: ${invalid.map((row) => row.id).join(', ')}`,
      );

    // Display balance and base-unit labels are derived, never independent facts.
    await runner.query(
      'ALTER TABLE wallets DROP CONSTRAINT wallets_balances_valid, DROP COLUMN balance, DROP COLUMN base_currency',
    );

    await runner.query(`ALTER TABLE wallets
      ADD COLUMN balance numeric GENERATED ALWAYS AS (round(kobo_balance / 100, 2)) STORED,
      ADD COLUMN base_currency wallets_base_currency_enum GENERATED ALWAYS AS
        (CASE currency WHEN 'NGN' THEN 'KOBO'::wallets_base_currency_enum
          WHEN 'USD' THEN 'CENTS'::wallets_base_currency_enum
          WHEN 'GHS' THEN 'PESEWA'::wallets_base_currency_enum END) STORED,
      ADD CONSTRAINT wallets_balances_valid CHECK ((kobo_balance >= 0 AND kobo_balance <= 9007199254740991 AND kobo_balance = trunc(kobo_balance)) IS TRUE)`);
  }
  async down(): Promise<void> {
    throw new Error(
      'Restoring writable duplicate balances requires a reviewed migration',
    );
  }
}
