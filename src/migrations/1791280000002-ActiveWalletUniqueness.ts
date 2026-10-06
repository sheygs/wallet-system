import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActiveWalletUniqueness1791280000002 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Keep writes out between the duplicate inventory and index creation.
    // TypeORM runs this migration inside its migration transaction.
    await queryRunner.query('LOCK TABLE wallets IN SHARE ROW EXCLUSIVE MODE');
    const duplicates = await queryRunner.query(`
      SELECT user_id, currency, COUNT(*) AS wallet_count
      FROM wallets
      WHERE deleted_at IS NULL
      GROUP BY user_id, currency
      HAVING COUNT(*) > 1
      ORDER BY user_id, currency
      LIMIT 10
    `);
    if (duplicates.length > 0) {
      throw new Error(
        `Active wallet duplicates exist; reconcile them before applying this migration. Sample groups: ${JSON.stringify(duplicates)}`,
      );
    }
    await queryRunner.query(`
      CREATE UNIQUE INDEX wallets_active_user_currency_unique
      ON wallets (user_id, currency)
      WHERE deleted_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX wallets_active_user_currency_unique');
  }
}
