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
32 bytes and `JWT_EXPIRY=1h`. New signup passwords require 12–72 characters and
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
these safeguards, so the least-privilege runtime role remains a follow-up.

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
`9007199254740991`. Display balances must equal minor units divided by 100;
the service formats them with exact integer arithmetic. Ledger/transfer amounts
must be positive whole numbers within the same limit. Transfer wallets must be
different and exist; ledger wallets and any recorded user/reviewer IDs must
exist. Referenced records cannot be hard-deleted, while wallet archival preserves
history.

Successful ledger entries reject ordinary SQL UPDATE and DELETE, including
changes that would free an already credited reference. Pending/failed entries
remain mutable until successful. Corrections require a designed compensating
entry or audited administrative repair, not rewriting successful history.
Privileged database owners can still alter/drop these safeguards or truncate
records; the application's least-privilege database role remains a separate
follow-up. Tests use privileged truncation only in a disposable database.

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

- Please see `/postman_docs` on the root directory OR
- Navigate to `http://localhost:4000/docs` on your computer to view the openapi documentation.

## Improvement Points

- Implement a Notification process (email/mobile notification) when an automated deposit fails due to insufficient funds.
- Implement Phone Number verification using third-party SMS providers e.g. Twilio API
