#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v database="$POSTGRES_DB" \
  -v migration_role="$POSTGRES_MIGRATION_USER" -v migration_password="$POSTGRES_MIGRATION_PASSWORD" \
  -v runtime_role="$POSTGRES_RUNTIME_USER" -v runtime_password="$POSTGRES_RUNTIME_PASSWORD" \
  -f /opt/wallet-database/provision-roles.sql
