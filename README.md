# Wallet-System

The Wallet System Service is an API that mocks a basic wallet system. The API provides information about various aspects of wallet systems such as User Authentication/Role-Based Authorization, Paystack API Gateway integration for wallet funding, Wallet Creation, Wallet Balance Retrieval, Wallet Funds Transfer and Transaction History Summary.

## Features

- User Authentication/Role-Based Authorization
- User Wallets Creation
- Wallet Account Crediting/Funding via Paystack Payment Gateway
- Wallet Funds Transfer & Approval
- Wallet Balance Retrival
- Wallet Transaction History

## High Level Implementation Details

The following steps were followed in the implementation of a wallet system with minimalistic features leveraging on the Paystack API Gateway:

1. PayStack Account Setup: Visit the Paystack website (`https://paystack.com`) and sign up for an account. Then obtain the API keys from the `developer section` of the the aforementioned website. Paystack provides both test and production keys for development and testing purposes. However, in most cases, one'd be utilizing the test keys.

2. Paystack API Integration.

3. Create Wallet Functionality: Within the application, the necessary logic and database structure were implemented to manage user wallets. This involved creating a wallet table, associating wallets with the user accounts, defining actions such as deposit, withdrawal amongst others.

4. User Authentication/Role-Based (Admin) Authorization: A user authentication system was implemented to secure wallet functionality. This includes features like user registration, user login, JWT token authentication, API endpoints protection.

5. Funds Deposit to Wallets: The Paystack API was used to create a payment request or payment authorization link for crediting funds into a user's wallet. This involved setting the necessary details to Paystack like including amount, customer details, and callback URL to handle payment response.

6. The requested amount must be sent in the subunit of that currency. For example, if a customer is supposed to make a payment of `NGN 100`, you would send `10000 = 100 * 100` in your request.

7. Payments Verification: After a payment is made, Paystack will send a `callback` to your specified URL i.e. `http://example.com` either set on the paystack developer dashboard or the one specified in your implementation. Once the notification has been processed, verify the transaction status and update the user's wallet accordingly.

8. Wallet Withdrawal Functionality: This was implemented from the scratch - point `3`. For every `deposit` or `transfer` request initiated, a request was logged to the `wallet_transactions` to keep track of the wallet transactions.

9. Balance Retrieval & Transaction History: Endpoints were implemented to retrieve user's wallets balances' & transaction history. This involves querying from the `wallet_transactions` and `wallets` tables to spool the results data sets.

## Project Structure

Overall, the project is designed to be scalable, maintainable and extensible. The use of a monolithic architecture that can easily spin off to a micro-service following modular architecture pattern that promotes code organization and separation of concerns.

## Development Tools

- [NodeJS](https://nodejs.org/en/download/)
- [NestJS](https://docs.nestjs.com/)
- [PostgreSQL](https://www.postgresql.org/download/)
- [Typeorm](https://typeorm.io/)
- [Jest](https://jestjs.io/)

## Requirements

- [Paystack](https://paystack.com/docs/api/)
- [Postman](https://www.postman.com/downloads/)
- [Git](https://git-scm.com/downloads)

## Rename _.env.sample_ to _.env_ and replace the placeholders

```bash
PORT=4000
NODE_ENV=development
PAYSTACK_SECRET_KEY=XXXX
PAYSTACK_API_BASE_URL=https://api.paystack.co
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=XXXX
POSTGRES_PASSWORD=XXXX
POSTGRES_DB=postgres
DB_TYPE=postgres
MININUM_APPROVAL_AMOUNT=1000000

TEST_PAYSTACK_SECRET_KEY=XXXX
TEST_PAYSTACK_API_BASE_URL=https://api.paystack.co
TEST_POSTGRES_HOST=localhost
TEST_POSTGRES_PORT=5432
TEST_POSTGRES_USER=XXXX
TEST_POSTGRES_PASSWORD=XXXX
TEST_POSTGRES_DB=XXXX
```

## Runtime and security checks

Use Node 24 LTS (`nvm use`) and Yarn 1.22.22. Install with
`yarn install --frozen-lockfile`. Set `JWT_SECRET` to a random secret of at least
32 bytes and `JWT_EXPIRY=15m`. New signup passwords require 12–72 characters and
must fit in 72 UTF-8 bytes; existing shorter passwords can still log in.

Schema updates use migrations; automatic schema synchronization is disabled.
Use a dedicated disposable database for `TEST_POSTGRES_*` because integration
tests delete their fixture tables. CI provisions that database automatically.
Run `yarn format:check`, `yarn lint`, `yarn typecheck`, `yarn build`, `yarn test --runInBand`, and
`yarn test:e2e`. Production Docker containers run as a non-root user and log to
stdout.

## Transfer request idempotency

`POST /api/v1/transfers` now requires an `Idempotency-Key` header: 1–128 ASCII
letters, digits, dots, underscores, colons or hyphens. A UUID is a suitable key.
Generate and retain the key before the first submission; reuse it for retries of
that same transfer, and use a new key for a deliberate new transfer.

```http
POST /api/v1/transfers
Authorization: Bearer <access-token>
Idempotency-Key: 901b410a-ec8d-443a-855e-aec4496c8366
Content-Type: application/json

{"source_wallet_id":"<source UUID>","destination_wallet_id":"<destination UUID>","amount":1000,"currency":"NGN"}
```

Keys are scoped to the authenticated user and this transfer endpoint. Identical
retries, including concurrent requests, return the original HTTP 200 JSON
response without creating another transfer or ledger entry. UUID casing and
omitted versus explicit wallet currency are normalized. Reusing a recorded key
with a different wallet, amount, currency or reason returns HTTP 409. Missing or
invalid keys return HTTP 400.

The response snapshot, request fingerprint and key are committed in the same
transaction as the transfer and any settlement. A failed transaction records
neither a transfer nor its key, so the same request can be retried after the
failure is resolved. The snapshot stays unchanged even if a pending transfer is
later approved/rejected or a wallet is archived; retries report the original
creation result, while the approval endpoint reports the current reviewed result.

Recorded keys do not expire and ordinary SQL cannot edit or delete them. Migration
rollback is blocked once a key is recorded. Existing historical transfers have no
reliable client keys to backfill; update clients and reconcile outstanding
unkeyed requests during rollout. Privileged database owners can still override
these safeguards, and production now requires the restricted runtime role described below.

VS Code configuration sets the project TypeScript path and selection prompt,
and selects ESLint's flat config. If the editor is still using a bundled TypeScript version, choose
**TypeScript: Select TypeScript Version → Use Workspace Version**. The
`yarn typecheck` command checks application and test files with explicit Node/Jest
types, independently of the production build.

## Financial database safeguards

Successful deposits require a nonblank provider reference, unique across all
wallets. Pending/failed attempts may share that reference; only one can become
successful. Replay rejected by either the service check or database index returns
HTTP 409, and the deposit transaction rolls back its balance update.

Wallet minor-unit balances must be nonnegative whole numbers at most
`9007199254740991`. Display balances are generated from minor units divided by 100 with exact
database arithmetic. Ledger/transfer amounts
must be positive whole numbers within the same limit. Transfer wallets must be
different and exist; ledger wallets and any recorded user/reviewer IDs must
exist. Referenced records cannot be hard-deleted, while wallet archival preserves
history.

Successful ledger entries reject ordinary SQL UPDATE and DELETE, including
changes that would free an already credited reference. Pending/failed entries
remain mutable until successful. Corrections require a designed compensating
entry or audited administrative repair, not rewriting successful history.
Privileged database owners can still alter/drop these safeguards or truncate
records; production uses a separate restricted runtime role. Tests use privileged truncation only in a disposable database.

The financial integrity migration locks writes, checks duplicate/missing paid
references, invalid/inconsistent balances and amounts, self transfers, and
orphan wallet/user references. Invalid legacy data stops the migration with issue
categories and sample record IDs; it is not modified. Reconcile these records
before retrying, and use a maintenance window for the migration. Existing unknown
legacy ledger authors remain null rather than being invented. Reverting removes
the safeguards without rewriting financial data.

## Wallet uniqueness

Each user may have one active wallet per currency. An omitted currency defaults
to NGN for both duplicate checking and creation; owning a USD or GHS wallet does
not prevent creating that default NGN wallet. Sequential and simultaneous
requests for the same currency return HTTP 409 once a wallet exists.

PostgreSQL enforces this rule with a unique index on `(user_id, currency)` for
rows whose `deleted_at` is null. Archived wallets remain in the database,
including their balances and history. Restoring an archived wallet also fails if
another active wallet already occupies its user/currency pair.

The uniqueness migration locks wallet writes while checking existing data and
building the index. Schedule a maintenance window before applying it to an
existing database. If active duplicates exist, it stops with sample user/currency
groups and does not delete or merge any wallet. Inventory all duplicate groups
with:

```sql
SELECT user_id, currency, COUNT(*) AS wallet_count
FROM wallets
WHERE deleted_at IS NULL
GROUP BY user_id, currency
HAVING COUNT(*) > 1;
```

Reconcile duplicate wallets, balances, and related transfers/ledger records
before rerunning the migration. Reverting this migration removes the index but
preserves all data.

## Transfer approvals

Amounts are integer currency minor units. Transfers at or below
`MININUM_APPROVAL_AMOUNT` (default `1000000`) execute immediately. Larger
transfers return `status: pending` and `transfer pending approval`, without
moving or reserving funds. The threshold must be a nonnegative safe integer;
`0` requires approval for every transfer.

An admin reviews a request with `PATCH /api/v1/transfers/:transfer_id/approve`
and `{ "approved": true }` to settle, or `{ "approved": false }` to reject.
Approval rechecks current ownership, currency, and available funds, then commits
both balances, the successful ledger entry, and reviewer metadata together.
Rejected or executed requests cannot be reviewed again (HTTP 409). Insufficient
funds at approval return HTTP 422 and leave the request pending for retry or
rejection. The response includes the resulting transfer and its status.

The lifecycle migration marks all preexisting transfers as executed because the
old implementation moved funds at creation, even when labelled pending. It does
not move balances or invent historical reviewer identities. Back up and reconcile
legacy transfer records before rollout; stop old application writers while
running the migration and deploy the new code together. Automatic rollback is
blocked to avoid making settled transfers eligible for another debit.

## Installation 📦

```bash
   $ git clone https://github.com/sheygs/wallet-system.git
   $ cd wallet-system
   $ yarn install
```

## Development

```bash
   $ yarn run start:dev
```

## Running the Service

## Docker

- Install [Docker](https://www.docker.com/)
- Run `docker-compose up -d`.
- Open browser and visit `http://localhost:4000` and rock it

## Without Docker

- Run `yarn install` to install project dependencies
- Run `yarn start:dev` to run the services and you are good
- Open browser and visit `http://localhost:4000` and rock it

## Production Packaging

- RUN `yarn run start:prod` to start the production build

```text
docker build -t ${IMAGETAG} -f Dockerfile .
```

## Test

```bash
   $ yarn test:e2e
```

## Postman Documentation

- Import [the Postman collection](postman_docs/Wallet_System.postman_collection.json) and follow [its setup guide](postman_docs/README.md).
- Navigate to `http://localhost:4000/docs` on your computer to view the openapi documentation.

## Improvement Points

- Implement a Notification process (email/mobile notification) when an automated deposit fails due to insufficient funds.
- Implement Phone Number verification using third-party SMS providers e.g. Twilio API

## Security review completion and production rollout

The remaining application findings from the security review
now have implementations and regression coverage. Nest 12.1.2 and TypeScript
6.0.3 run on Node 24.15+; the Jest scripts enable VM modules for Nest's ESM
packages while the application stays CommonJS.

Access tokens enforce HS256, issuer (`JWT_ISSUER`, default `wallet-system`),
audience (`JWT_AUDIENCE`, default `wallet-system-api`), UUID identity, expiry and
an account revocation version. `JWT_EXPIRY` defaults to `15m` and accepts explicit
`s`, `m` or `h` units up to one hour. Existing tokens must be replaced by logging
in after rollout. Login returns `refresh_token` and `refresh_expires_at` alongside
`access_token`. Submit the refresh token once to `POST /api/v1/auth/refresh`;
store its replacement atomically. Families have a fixed seven-day expiry.
Refresh reuse, including concurrent refresh requests, revokes all account
sessions. `POST /api/v1/auth/logout` also revokes all sessions immediately.

All API replicas share PostgreSQL rate counters: 60 requests/minute per IP,
5 signup/login requests per minute per IP, and 5 login attempts per minute per
account with five-minute backoff. Email and phone aliases share the account's
bucket. Forwarded IP headers are ignored unless `TRUSTED_PROXIES` contains
explicit trusted IPs/CIDRs. The database limiter fails closed on storage errors;
schedule [auth-maintenance.sql](scripts/database/auth-maintenance.sql) daily.
Alert on `security.rate_limit_blocked` and `security.refresh_token_reuse` events.

Production Swagger is disabled. Browser clients require an exact comma-separated
`CORS_ORIGINS` allowlist; wildcard origins are rejected. Remote production database
connections default to `POSTGRES_SSL_MODE=verify-full`, with system trust or a CA
file supplied through `POSTGRES_SSL_CA_FILE`. Only an explicitly configured local
or private Compose connection permits `disable`.

Transaction history now takes paired `YYYY-MM-DD` dates or paired month/year
filters, rejects mixed/incomplete filters, includes the final UTC day and caps
ranges at 366 days. Without filters it returns the last 30 UTC days. Results are
`data: { items, next_cursor }`, ordered by timestamp and UUID. Set `limit` from
1–100 (default 50); pass `next_cursor` with the same date filters to continue.
Cursors preserve PostgreSQL microsecond precision. The updated Postman collection
includes pagination, token rotation and logout.

`kobo_balance` remains the compatible field name for integer minor units in all
three currencies. `balance` and `base_currency` are generated database columns:
NGN/KOBO, USD/CENTS and GHS/PESEWA. They cannot be written independently, and wallet
currency is immutable. Both sides of every new successful transfer are recorded
in `ledger_entries`; deposits balance against an external clearing account.
Journals and entries are append-only, currency-consistent and balanced at commit.
Migration opening checkpoints preserve existing balances without inventing
historical transactions. Reconciliation checks all wallets, including archived
wallets, at production startup and every minute; alert on
`security.balance_reconciliation_failed` or `security.reconciliation_check_failed`.
The stored minor-unit balance serves reads; reconciliation detects drift instead
of silently replacing it. Audited owner-only corrections use
`post_wallet_correction(wallet_uuid, signed_minor_units, unique_reference, reason)`
to append a compensating entry and update the balance atomically.

Production startup runs no migrations and refuses privileged/owner database
credentials or pending migrations. Compose provisions a separate schema owner and
runtime login, runs a migration job, applies explicit runtime grants, then starts
the API. Configure bootstrap `POSTGRES_USER/PASSWORD`, separate
`POSTGRES_MIGRATION_USER/PASSWORD`, and `POSTGRES_RUNTIME_USER/PASSWORD`.
[scripts/database/provision-roles.sql](scripts/database/provision-roles.sql) and
[grant-runtime.sql](scripts/database/grant-runtime.sql) provide the same setup for
an existing database. Supply their psql variables using your deployment's secret
handling; apply grants after every migration. The runtime role cannot own tables,
create schema objects, truncate history, create pre-funded wallets or execute
administrative corrections. Schema preflight rejects incompatible columns, enums,
keys, nullability, uniqueness or wallet foreign keys for explicit repair.

**Existing deployments require a logical backup/restore before switching images.**
The database stays PostgreSQL 15 but moves from glibc/Debian to musl/Alpine.
Compose uses a new `pgdata_alpine` volume and does not attach the old `pgdata`
volume. Stop old application writers, back up roles and data, restore with
`pg_dump`/`pg_restore` into the new volume, provision migration ownership, apply
migrations and runtime grants, and verify balances, collation-sensitive indexes,
opening checkpoints and application behavior before directing traffic to it.
Keep the original backup and volume for recovery. Opening balances still need
comparison with verified provider/bank statements; the synthetic rehearsal does
not verify production financial history.

A repeatable disposable rehearsal is provided by
[rehearse-upgrade.cjs](scripts/database/rehearse-upgrade.cjs). Run `yarn build`, set
`TEST_POSTGRES_*`, `REHEARSAL_POSTGRES_DB=wallet_security_rehearsal_legacy` and
`REHEARSAL_SNAPSHOT_FILE` to a temporary JSON path, then run
`node scripts/database/rehearse-upgrade.cjs prepare` against an empty database.
Dump it, restore into another disposable `wallet_security_rehearsal_*` database,
point the test settings and rehearsal name at that restore, and run the script's
`upgrade` mode. It checks restoration and migration preservation of users,
balances, transfers, history and idempotency records, derived units and ledger
reconciliation. Never use the rehearsal with real deployment databases.
