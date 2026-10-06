import { MigrationInterface, QueryRunner } from 'typeorm';

export class HistoryIndex1791280000006 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      'CREATE INDEX wallet_transactions_history_idx ON wallet_transactions(created_at, id)',
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP INDEX wallet_transactions_history_idx');
  }
}
