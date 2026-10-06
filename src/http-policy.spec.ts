import { httpPolicy } from './http-policy';
import { databaseOptions } from './database/connection-policy';

describe('Production HTTP and database policy', () => {
  it('disables production documentation, arbitrary CORS and proxy headers by default', () => {
    expect(httpPolicy({ NODE_ENV: 'production' })).toEqual({
      origins: false,
      proxies: false,
      swagger: false,
    });
  });

  it('accepts exact allowlisted origins and explicit proxy networks', () => {
    expect(
      httpPolicy({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://wallet.example.com,https://admin.example.com',
        TRUSTED_PROXIES: '127.0.0.1,10.10.1.0/24',
      }),
    ).toEqual({
      origins: ['https://wallet.example.com', 'https://admin.example.com'],
      proxies: ['127.0.0.1', '10.10.1.0/24'],
      swagger: false,
    });
  });

  it.each(['true', '1', '*', '0.0.0.0/0', '::/0', '10.0.0.1/33'])(
    'rejects unsafe trusted proxy setting %s',
    (value) => {
      expect(() => httpPolicy({ TRUSTED_PROXIES: value })).toThrow();
    },
  );

  it.each([
    '*',
    'https://wallet.example.com/path',
    'http://wallet.example.com',
    'https://user:pass@wallet.example.com',
  ])('rejects unsafe production origin %s', (value) => {
    expect(() =>
      httpPolicy({ NODE_ENV: 'production', CORS_ORIGINS: value }),
    ).toThrow();
  });

  it('rejects public production documentation', () => {
    expect(() =>
      httpPolicy({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }),
    ).toThrow();
  });

  it('uses verified remote TLS and separate production migrations', () => {
    const options = databaseOptions({
      NODE_ENV: 'production',
      POSTGRES_HOST: 'db.example.com',
    });
    expect(options).toMatchObject({
      ssl: { rejectUnauthorized: true },
      migrationsRun: false,
      synchronize: false,
      extra: { options: '-c timezone=UTC' },
      invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' },
    });
  });

  it('refuses to disable TLS for a remote production database', () => {
    expect(() =>
      databaseOptions({
        NODE_ENV: 'production',
        POSTGRES_HOST: 'db.example.com',
        POSTGRES_SSL_MODE: 'disable',
      }),
    ).toThrow();
  });

  it('permits the explicit private Compose database connection', () => {
    expect(
      databaseOptions({
        NODE_ENV: 'production',
        POSTGRES_HOST: 'postgres',
        POSTGRES_SSL_MODE: 'disable',
      }),
    ).toMatchObject({ ssl: false, migrationsRun: false });
  });
});
