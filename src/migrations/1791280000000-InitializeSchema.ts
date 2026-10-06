import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitializeSchema1791280000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    for (const [name, values] of [
      ['wallets_currency_enum', "'NGN', 'USD', 'GHS'"],
      ['wallets_base_currency_enum', "'KOBO', 'CENTS', 'PESEWA'"],
      ['transfers_currency_enum', "'NGN', 'USD', 'GHS'"],
      ['transfers_status_enum', "'pending', 'approved'"],
      ['wallet_transactions_transaction_type_enum', "'DEPOSIT', 'TRANSFER'"],
      [
        'wallet_transactions_transaction_status_enum',
        "'pending', 'successful', 'failed'",
      ],
    ]) {
      await queryRunner.query(
        `DO $$ BEGIN CREATE TYPE "${name}" AS ENUM (${values}); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      );
    }
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), first_name varchar(50) NOT NULL,
      last_name varchar(50) NOT NULL, email varchar UNIQUE, password varchar NOT NULL,
      phone_number varchar(20) UNIQUE, is_admin boolean DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp DEFAULT now(), deleted_at timestamp
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS wallets (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL REFERENCES users(id),
      balance numeric NOT NULL DEFAULT 0, kobo_balance numeric NOT NULL DEFAULT 0,
      currency wallets_currency_enum NOT NULL DEFAULT 'NGN',
      base_currency wallets_base_currency_enum NOT NULL DEFAULT 'KOBO',
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp DEFAULT now(), deleted_at timestamp
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS transfers (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), source_wallet_id uuid NOT NULL,
      destination_wallet_id uuid NOT NULL, transferred_amount numeric NOT NULL,
      currency transfers_currency_enum DEFAULT 'NGN', reason text,
      status transfers_status_enum NOT NULL DEFAULT 'pending', approved boolean DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS wallet_transactions (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid, source_wallet_id uuid NOT NULL,
      amount numeric NOT NULL, reference varchar,
      transaction_type wallet_transactions_transaction_type_enum NOT NULL,
      transaction_status wallet_transactions_transaction_status_enum NOT NULL DEFAULT 'pending',
      created_at timestamp NOT NULL DEFAULT now()
    )`);
  }

  async down(): Promise<void> {
    // This baseline may adopt existing tables; dropping them would destroy pre-existing data.
    throw new Error('The baseline migration cannot be reverted automatically');
  }
}
