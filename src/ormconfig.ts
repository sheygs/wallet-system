import 'dotenv/config';
import { databaseOptions } from './database/connection-policy';

export const dataSource = databaseOptions();
