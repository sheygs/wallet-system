import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthSecurity1791280000005 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE users ADD COLUMN auth_version integer NOT NULL DEFAULT 0 CHECK (auth_version >= 0)`,
    );
    await runner.query(`CREATE TABLE refresh_tokens (
      token_hash varchar(64) PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      family_id uuid NOT NULL, auth_version integer NOT NULL, expires_at timestamptz NOT NULL,
      used_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      'CREATE INDEX refresh_tokens_user_idx ON refresh_tokens(user_id)',
    );
    await runner.query(
      'CREATE INDEX refresh_tokens_expiry_idx ON refresh_tokens(expires_at)',
    );
    await runner.query(`CREATE TABLE auth_rate_limits (
      key varchar(64) PRIMARY KEY, hits integer NOT NULL CHECK (hits > 0),
      expires_at timestamptz NOT NULL, blocked_until timestamptz
    )`);
    await runner.query(
      'CREATE INDEX auth_rate_limits_expiry_idx ON auth_rate_limits(expires_at)',
    );
  }
  async down(): Promise<void> {
    throw new Error(
      'Auth security rollback requires explicit token invalidation and a reviewed migration',
    );
  }
}
