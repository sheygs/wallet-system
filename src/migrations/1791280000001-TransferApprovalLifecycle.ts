import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransferApprovalLifecycle1791280000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Replacing the enum lets the new values be used inside this migration's
    // transaction (PostgreSQL disallows using newly added enum values there).
    await queryRunner.query(
      `CREATE TYPE transfers_status_enum_v2 AS ENUM ('pending', 'approved', 'rejected', 'executed')`,
    );
    await queryRunner.query(
      'ALTER TABLE transfers ALTER COLUMN status DROP DEFAULT',
    );
    // The old workflow moved money at creation, even for rows labelled pending.
    // Treat every historical row as settled; ambiguous rows need reconciliation,
    // never another automatic debit through the approval endpoint.
    await queryRunner.query(
      `ALTER TABLE transfers ALTER COLUMN status TYPE transfers_status_enum_v2 USING ('executed'::transfers_status_enum_v2)`,
    );
    await queryRunner.query('DROP TYPE transfers_status_enum');
    await queryRunner.query(
      'ALTER TYPE transfers_status_enum_v2 RENAME TO transfers_status_enum',
    );
    await queryRunner.query(
      `ALTER TABLE transfers ALTER COLUMN status SET DEFAULT 'pending'::transfers_status_enum`,
    );
    await queryRunner.query(`ALTER TABLE transfers
      ADD COLUMN requires_approval boolean NOT NULL DEFAULT false,
      ADD COLUMN requested_by uuid,
      ADD COLUMN reviewed_by uuid,
      ADD COLUMN reviewed_at timestamp`);
    await queryRunner.query(
      `UPDATE transfers t SET requested_by = w.user_id FROM wallets w WHERE w.id = t.source_wallet_id`,
    );
  }

  async down(): Promise<void> {
    throw new Error(
      'Transfer lifecycle backfill requires manual rollback to prevent re-executing historical transfers',
    );
  }
}
