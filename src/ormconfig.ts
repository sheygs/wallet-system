import 'dotenv/config';

export let config: any = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: +process.env.POSTGRES_PORT,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production',
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  migrationsRun: true,
  logging: true,
};

if (process.env.NODE_ENV === 'test') {
  config = {
    type: 'postgres',
    host: process.env.TEST_POSTGRES_HOST,
    port: +process.env.TEST_POSTGRES_PORT,
    username: process.env.TEST_POSTGRES_USER,
    password: process.env.TEST_POSTGRES_PASSWORD,
    database: process.env.TEST_POSTGRES_DB,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: false,
    migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
    migrationsRun: true,
    logging: false,
  };
}
