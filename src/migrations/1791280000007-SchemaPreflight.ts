import { MigrationInterface, QueryRunner } from 'typeorm';
import { schemaPreflight } from '../database/schema-preflight';

export class SchemaPreflight1791280000007 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await schemaPreflight(runner);
  }
  async down(): Promise<void> {}
}
