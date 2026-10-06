import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransferIdempotency1791280000004 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Existing transfers have no client key to backfill reliably.
    await queryRunner.query(`CREATE TABLE transfer_requests (
      user_id uuid NOT NULL,
      idempotency_key varchar(128) NOT NULL,
      request_hash char(64) NOT NULL,
      transfer_id uuid NOT NULL,
      response jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT transfer_requests_pkey PRIMARY KEY (user_id, idempotency_key),
      CONSTRAINT transfer_requests_transfer_id_unique UNIQUE (transfer_id),
      CONSTRAINT transfer_requests_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT transfer_requests_transfer_fk FOREIGN KEY (transfer_id) REFERENCES transfers(id) ON DELETE RESTRICT,
      CONSTRAINT transfer_requests_key_valid CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{1,128}$'),
      CONSTRAINT transfer_requests_hash_valid CHECK (request_hash ~ '^[0-9a-f]{64}$'),
      CONSTRAINT transfer_requests_response_valid CHECK ((jsonb_typeof(response) = 'object' AND (response->>'id')::uuid = transfer_id AND response->>'requested_by' = user_id::text) IS TRUE)
    )`);

    await queryRunner.query(`CREATE FUNCTION protect_transfer_request() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Recorded transfer requests cannot be changed or deleted'
          USING ERRCODE = '23514', CONSTRAINT = 'transfer_requests_immutable';
      END;
    $$`);

    await queryRunner.query(`CREATE TRIGGER transfer_requests_immutable BEFORE UPDATE OR DELETE
      ON transfer_requests FOR EACH ROW EXECUTE FUNCTION protect_transfer_request()`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'LOCK TABLE transfer_requests IN ACCESS EXCLUSIVE MODE',
    );

    const [{ count }] = await queryRunner.query(
      'SELECT COUNT(*) FROM transfer_requests',
    );

    if (Number(count) > 0) {
      throw new Error(
        'Cannot remove recorded idempotency keys: doing so could allow transfers to execute again',
      );
    }
    await queryRunner.query('DROP TABLE transfer_requests');
    await queryRunner.query('DROP FUNCTION protect_transfer_request()');
  }
}
