import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class RuntimeDatabasePolicy implements OnModuleInit {
  constructor(private readonly db: DataSource) {}
  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') return;
    const [role] = await this.db.query(`SELECT EXISTS (
      SELECT 1 FROM pg_roles WHERE (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls
        OR rolname IN ('pg_read_server_files', 'pg_write_server_files', 'pg_execute_server_program', 'pg_checkpoint', 'pg_read_all_data', 'pg_write_all_data'))
        AND pg_has_role(current_user, oid, 'MEMBER')
    ) AS privileged`);
    const [access] = await this.db.query(`SELECT
      EXISTS (SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user, r.oid, 'MEMBER')
        AND has_schema_privilege(r.oid, current_schema(), 'CREATE')) AS schema_create,
      EXISTS (SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user, r.oid, 'MEMBER')
        AND has_database_privilege(r.oid, current_database(), 'CREATE')) AS database_create,
      EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p')
        AND (pg_has_role(current_user, c.relowner, 'MEMBER') OR EXISTS (
          SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user, r.oid, 'MEMBER')
            AND has_table_privilege(r.oid, c.oid, 'TRUNCATE')))) AS table_control`);
    if (
      !role ||
      role.privileged ||
      access.schema_create ||
      access.database_create ||
      access.table_control
    )
      throw new Error(
        'Production requires a runtime database role without ownership, DDL, superuser or TRUNCATE privileges',
      );
    const pending = await this.db.showMigrations();
    if (pending)
      throw new Error(
        'Pending database migrations: run the separate migration job before starting the API',
      );
  }
}
