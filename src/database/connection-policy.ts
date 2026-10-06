import { readFileSync } from 'node:fs';
import { DataSourceOptions } from 'typeorm';
import { defaults, types } from 'pg';

// Legacy timestamp columns represent UTC. pg otherwise serializes/parses them
// using the host timezone, changing date boundaries during daylight saving.
defaults.parseInputDatesAsUTC = true;
types.setTypeParser(1114, (value: string) => new Date(`${value}Z`));

export function databaseOptions(
  env = process.env,
): Extract<DataSourceOptions, { type: 'postgres' }> {
  const test = env.NODE_ENV === 'test';
  const prefix = test ? 'TEST_POSTGRES_' : 'POSTGRES_';
  const production = env.NODE_ENV === 'production';
  const host = env[`${prefix}HOST`];
  const mode =
    env[`${prefix}SSL_MODE`] || (production ? 'verify-full' : 'disable');

  if (!['disable', 'verify-full'].includes(mode))
    throw new Error('Database SSL_MODE must be disable or verify-full');

  if (
    production &&
    mode === 'disable' &&
    !['localhost', '127.0.0.1', '::1', 'postgres'].includes(host)
  )
    throw new Error('Remote production databases require verified TLS');

  return {
    type: 'postgres',
    host,
    port: Number(env[`${prefix}PORT`] || 5432),
    username: env[`${prefix}USER`],
    password: env[`${prefix}PASSWORD`],
    database: env[`${prefix}DB`],
    ssl:
      mode === 'verify-full'
        ? {
            rejectUnauthorized: true,
            ...(env[`${prefix}SSL_CA_FILE`] && {
              ca: readFileSync(env[`${prefix}SSL_CA_FILE`], 'utf8'),
            }),
          }
        : false,
    extra: { options: '-c timezone=UTC' },
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false,
    migrations: [__dirname + '/../migrations/**/*{.ts,.js}'],
    migrationsRun: !production,
    logging: !production && !test,
    invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' },
  };
}
