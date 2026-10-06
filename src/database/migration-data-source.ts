import 'dotenv/config';
import { DataSource } from 'typeorm';
import { databaseOptions } from './connection-policy';

export default new DataSource({ ...databaseOptions(), migrationsRun: false });
