import { QueryRunner } from 'typeorm';

const shapes: Record<string, Record<string, string>> = {
  users: {
    id: 'uuid',
    first_name: 'character varying',
    last_name: 'character varying',
    email: 'character varying',
    password: 'character varying',
    phone_number: 'character varying',
    is_admin: 'boolean',
    created_at: 'timestamp without time zone',
    updated_at: 'timestamp without time zone',
    deleted_at: 'timestamp without time zone',
  },
  wallets: {
    id: 'uuid',
    user_id: 'uuid',
    balance: 'numeric',
    kobo_balance: 'numeric',
    currency: 'wallets_currency_enum',
    base_currency: 'wallets_base_currency_enum',
    created_at: 'timestamp without time zone',
    updated_at: 'timestamp without time zone',
    deleted_at: 'timestamp without time zone',
  },
  transfers: {
    id: 'uuid',
    source_wallet_id: 'uuid',
    destination_wallet_id: 'uuid',
    transferred_amount: 'numeric',
    currency: 'transfers_currency_enum',
    reason: 'text',
    status: 'transfers_status_enum',
    approved: 'boolean',
    created_at: 'timestamp without time zone',
    updated_at: 'timestamp without time zone',
  },
  wallet_transactions: {
    id: 'uuid',
    user_id: 'uuid',
    source_wallet_id: 'uuid',
    amount: 'numeric',
    reference: 'character varying',
    transaction_type: 'wallet_transactions_transaction_type_enum',
    transaction_status: 'wallet_transactions_transaction_status_enum',
    created_at: 'timestamp without time zone',
  },
};

const required: Record<string, string[]> = {
  users: ['id', 'first_name', 'last_name', 'password', 'created_at'],
  wallets: ['id', 'user_id', 'kobo_balance', 'currency', 'created_at'],
  transfers: [
    'id',
    'source_wallet_id',
    'destination_wallet_id',
    'transferred_amount',
    'status',
    'created_at',
  ],
  wallet_transactions: [
    'id',
    'source_wallet_id',
    'amount',
    'transaction_type',
    'transaction_status',
    'created_at',
  ],
};

export async function schemaPreflight(runner: QueryRunner): Promise<void> {
  const issues: string[] = [];
  for (const [table, shape] of Object.entries(shapes)) {
    const [relation] = await runner.query('SELECT to_regclass($1) AS name', [
      table,
    ]);
    if (!relation.name) continue;
    await runner.query(`LOCK TABLE "${table}" IN SHARE ROW EXCLUSIVE MODE`);
    const columns: { attname: string; type: string; attnotnull: boolean }[] =
      await runner.query(
        `SELECT attname, format_type(atttypid, NULL) AS type, attnotnull FROM pg_attribute WHERE attrelid = to_regclass($1) AND attnum > 0 AND NOT attisdropped`,
        [table],
      );
    for (const [name, type] of Object.entries(shape)) {
      const column = columns.find((c) => c.attname === name);
      // Enum names can be qualified outside public; inspect their local name.
      if (!column || column.type.split('.').pop().replaceAll('"', '') !== type)
        issues.push(`${table}.${name}: expected ${type}`);
    }
    const keys = await runner.query(
      `SELECT array_agg(a.attname::text ORDER BY k.ordinality) AS columns
      FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(attnum, ordinality)
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      WHERE c.conrelid = to_regclass($1) AND c.contype = 'p' GROUP BY c.oid`,
      [table],
    );
    if (keys.length !== 1 || JSON.stringify(keys[0].columns) !== '["id"]')
      issues.push(`${table}: UUID id primary key required`);
    for (const name of required[table]) {
      if (columns.some((c) => c.attname === name && !c.attnotnull))
        issues.push(`${table}.${name}: NOT NULL required`);
    }
    if (table === 'users') {
      for (const column of ['email', 'phone_number']) {
        const indexes = await runner.query(
          `SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = to_regclass('users') AND i.indisunique AND i.indisvalid AND i.indpred IS NULL
          AND i.indexprs IS NULL AND i.indnkeyatts = 1 AND a.attname = $1`,
          [column],
        );
        if (!indexes.length)
          issues.push(`users.${column}: full unique index required`);
      }
    }
    if (table === 'wallets') {
      const foreign = await runner.query(`SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = to_regclass('wallets') AND c.confrelid = to_regclass('users') AND c.contype = 'f' AND c.convalidated
        AND c.confdeltype IN ('a','r')
        AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'user_id')]::smallint[]
        AND c.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.confrelid AND attname = 'id')]::smallint[]`);
      if (!foreign.length)
        issues.push(
          'wallets.user_id: validated restrictive users(id) foreign key required',
        );
    }
  }
  for (const [type, labels] of Object.entries({
    wallets_currency_enum: ['NGN', 'USD', 'GHS'],
    wallets_base_currency_enum: ['KOBO', 'CENTS', 'PESEWA'],
    transfers_currency_enum: ['NGN', 'USD', 'GHS'],
    transfers_status_enum: ['pending', 'approved'],
    wallet_transactions_transaction_type_enum: ['DEPOSIT', 'TRANSFER'],
    wallet_transactions_transaction_status_enum: [
      'pending',
      'successful',
      'failed',
    ],
  })) {
    const rows: { label: string }[] = await runner.query(
      'SELECT enumlabel AS label FROM pg_enum WHERE enumtypid = to_regtype($1) ORDER BY enumsortorder',
      [type],
    );
    if (
      rows.length &&
      (labels.some((label) => !rows.some((row) => row.label === label)) ||
        (type !== 'transfers_status_enum' && rows.length !== labels.length))
    )
      issues.push(`${type}: required enum labels missing`);
  }
  if (issues.length)
    throw new Error(
      `Existing schema preflight failed; repair explicitly before migration: ${issues.join('; ')}`,
    );
}
