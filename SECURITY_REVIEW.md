# Dependency and security review — 2026-10-06

## Scope and runtime

Reviewed application dependencies, authentication, wallet/deposit/transfer paths,
entities and migrations, Docker/Compose, CI, and existing tests. The workspace
already contained upgrade/security changes when this pass started; those were
preserved and validated. This is a source review and scanner check, not a
penetration test.

Node 24 is the LTS target in `.nvmrc`, `engines`, CI, and Docker. Validation used
Node 24.21.0. Packages without an LTS policy were updated within compatible
release families. Nest 11.2.7 remains the CommonJS framework baseline; Nest 12
is available but requires a separate ESM/TypeScript migration and should not be
represented as already migrated. Jest is now 30.5.2, ESLint 10.12.0, TypeScript
5.9.3, TypeORM 0.3.31, Axios 1.20.0, and bcrypt 6. PostgreSQL major 15 is
preserved to avoid an unplanned database-format upgrade and remains supported
until November 2027 ([support policy](https://www.postgresql.org/support/versioning/)).
Node LTS status: [official downloads](https://nodejs.org/en/download/).
Nest migration requirements: [official guide](https://docs.nestjs.com/migration-guide).

## Verified fixes and controls

- Authenticated ownership is checked for wallet creation, balance reads, payment
  initialization, deposits, and transfer source wallets. Admin authority is read
  from the database rather than trusted from a stale token.
- Wallet creation now defaults omitted currency to NGN for both checking and
  insertion. A PostgreSQL unique partial index enforces one active wallet per
  user/currency, including concurrent requests and direct database inserts.
  The service maps collisions on that index to HTTP 409 without hiding unrelated
  database errors. The migration locks writes, checks active duplicate groups,
  and refuses to proceed with duplicates instead of changing financial records.
  Archived wallets are retained and do not occupy the active-wallet slot.
- Transfer creation requires a scoped Idempotency-Key. The server serializes
  user/key requests using transaction advisory locks at READ COMMITTED, fingerprints
  normalized payloads, and atomically stores an immutable original response with
  the transfer. Matching retries return it without another debit; changed payloads
  return HTTP 409. Database key uniqueness, foreign keys and immutable request
  records support the application guard, and rollback cannot erase recorded keys.
- Auth signup narrows unknown database errors before reading PostgreSQL codes.
  Explicit Node/Jest types and source/test inclusion, workspace TypeScript/ESLint
  settings, and a CI full-project typecheck cover editor/compiler diagnostics.
  The editor's exact hover diagnostic was not supplied; command-line typecheck
  and lint are clean.
- Transfer approval now gates settlement: above-threshold requests remain pending
  with no reservation or successful ledger entry. Admin approval locks the request
  and wallets, rechecks available funds, and records execution and review in one
  transaction. Rejection is terminal; repeated/concurrent decisions cannot debit
  twice. The approval threshold is validated at startup and the original approval
  requirement is stored on each transfer. Legacy rows are conservatively marked
  executed by migration so their old pending labels cannot cause another debit.
- Transfers and deposits update balances and ledger records atomically. Wallet
  locks use stable ordering; deposits serialize provider references and reject
  duplicate successful credits. Provider success, reference, currency, amount,
  and ownership metadata must match before crediting.
- PostgreSQL now enforces unique nonblank successful deposit references, positive
  integral ledger/transfer amounts, nonnegative integral safe-range wallet balances,
  matching display balances, distinct transfer wallets, and wallet/user foreign
  keys. Successful ledger UPDATE/DELETE is blocked by a trigger. A reference-index
  collision becomes HTTP 409 after rolling back the credit. Display balances use
  exact integer formatting, including the maximum supported balance's last cent.
  Preflight locks writes and reports invalid legacy data without modifying it.
  These safeguards do not resist a privileged owner dropping them or truncating
  tables; a restricted runtime role and balance/ledger reconciliation remain
  follow-ups.
- Monetary amounts must be safe positive integers in minor units; resulting
  balances cannot overflow JavaScript's exact integer range. Removed the unused
  nontransactional balance-update method.
- Login is limited to five requests per minute per IP, with a global 60/minute
  limit. New passwords need at least 12 characters. UTF-8 inputs over bcrypt's
  72-byte limit are rejected instead of silently truncated. Existing shorter
  passwords can still authenticate. Startup requires a JWT secret of 32+ bytes.
- Signup responses omit password hashes; server errors return a generic message.
  Payment HTTP calls have timeouts, reject redirects, and encode references.
- Production runs as a non-root user with production-only dependencies,
  read-only Compose filesystem, dropped capabilities, and stdout logging.
  Docker uses Debian 13, applies OS security updates, removes npm/Yarn from the
  runtime, rebuilds PostgreSQL's gosu helper using Go 1.26.8 to remove vulnerable
  bundled Go code, and serializes the shared build cache to prevent package corruption.
- Schema synchronization is disabled; migrations create the baseline schema.
- CI pins existing checkout/setup actions, limits token permissions, performs
  format/lint/build/unit/integration checks, audits all dependencies, and scans
  fixable high/critical image findings with a digest-pinned Trivy image. Missing
  audit summaries, registry errors, and high/critical summaries fail the audit.

## Validation

- Full-project typecheck, format check, lint, build, and `git diff --check` pass.
- 52 unit tests and 114 integration tests pass against a disposable PostgreSQL 15
  database. New real-database tests verify concurrent debit serialization,
  single credit under deposit races, rollback when ledger insertion fails,
  pending requests, concurrent approval/rejection, competing approvals against
  one balance, insufficient funds at approval, role enforcement, and legacy
  migration without balance changes. Wallet uniqueness tests force concurrent
  requests past the precheck, verify duplicate error mapping, default currency,
  archived-wallet replacement/restoration, direct database enforcement, and
  clean/duplicate legacy migration behavior without record changes. Financial
  tests verify direct-write reference races, pending/successful transitions,
  successful ledger immutability, invalid/NaN/infinite/out-of-range amounts and
  balances, foreign-key enforcement, maximum-balance precision, replay rollback,
  and migration preflight, rollback, and nullable legacy-column checks. Idempotency
  tests cover simultaneous and sequential replay, competing payloads, per-user
  scope, key validation, payload normalization, rollback, review/archival replay,
  immutable result records, and migration data preservation and rollback guards.
- API and PostgreSQL Docker builds and restricted API HTTP smoke test pass.
- Yarn audit reports zero high/critical findings. One unpatched moderate
  `sprintf-js` advisory remains through Jest's coverage tooling, reported along
  eight dependency paths. Production-only Yarn audit reports zero findings.
  Advisory: https://github.com/advisories/GHSA-hp3w-g68c-fv3c
- API image scan dropped from 24 high/critical findings to three high findings
  and zero critical findings. Remaining findings have no published Debian fix:
  CVE-2026-102010 and CVE-2026-95619 (gcc-14 runtime libraries), and
  CVE-2026-85091 (zlib). The fixable high/critical Trivy gate passes. Scanners
  differ in advisory coverage; passing a gate is not a claim of zero risk.
- Full Trivy scans, including unfixed findings, report 43 high package findings
  across eight CVEs for the API (zero critical), and 62 high/critical package
  findings across 17 CVEs for PostgreSQL. All lack available distro fixes. The
  PostgreSQL scan includes **critical CVE-2026-6653 in libxml2**. Both fixable
  high/critical gates pass; this does not clear the unpatched critical finding.
  See [the scan summary](security-scan-summary.json) for CVEs and affected packages.
- The rebuilt gosu executable reports Go 1.26.8 and Trivy confirms its old Go
  findings are absent. Scout continues to report the original Go 1.24.6 metadata
  for that overridden file, so its derived PostgreSQL result is not used as
  evidence that the running helper is still on the old toolchain.
- CI configuration was checked locally; no hosted GitHub Actions run was made.
  The local Docker build is arm64; CI will also validate its amd64 image.

## Proposed high-level fixes, in priority order

| Priority | Finding and code | Proposed change |
| --- | --- | --- |
| High | PostgreSQL's libxml2 has an unpatched critical advisory, CVE-2026-6653. | Prioritize a distro security backport or a supported database image that resolves it. Assess reachability of database XML functions with the deployment's database roles; keep the database private and limit runtime privileges while remediation is pending. Do not treat the fixable-only gate as clearance of this finding. |
| Medium | In-memory/IP rate limiting resets on restart and is separate across replicas; auth has no account-level abuse control. | Use a shared Redis limiter with both account and IP keys, trusted proxy configuration, security metrics, and temporary backoff. Introduce refresh-token rotation/revocation and explicit JWT issuer/audience/algorithm policies. |
| Medium | Transaction history can construct invalid date bounds, excludes most of the last day, uses local time for months, and has no pagination. `WalletTransactionsService.getTransactionHistory`. | Validate paired ranges/month-year fields, use UTC half-open intervals, enforce maximum spans, index timestamps, and return cursor-paginated results with deterministic ordering. |
| Medium | Stored balances are not yet reconciled to a complete double-entry ledger; legacy transfer references do not always identify individual settlements. | Define debit/credit entries for both sides of every transfer, opening-balance policy and compensating corrections. Backfill only with reliable evidence, then add reconciliation and alerting before making ledger-derived balances authoritative. |
| Medium | Wallet `balance` duplicates minor-unit balance; currencies can retain NGN's default `base_currency`. | Store one integer minor-unit balance, derive display values, and map currency/base-unit consistently. Use bigint/decimal-safe arithmetic if balances must exceed the current safe-integer cap. |
| Medium | Database connection TLS and least-privilege application credentials are not configured. Startup also runs DDL migrations. | Use verified TLS for remote databases, a limited runtime role, and a separate migration role/job; test fresh installs and upgrades from a snapshot of the existing schema. |
| Medium | Baseline migration adopts existing tables with `IF NOT EXISTS` without validating their shape. | Add a migration preflight checking columns/enums/constraints and explicit repair migrations, backed by restoration rehearsals. Do not silently drop or rewrite existing data. |
| Low | Swagger is exposed in production and CORS allows any origin. `src/app.ts`. | Configure allowed origins and restrict or disable production API documentation according to the deployment's access model. |
| Maintenance | Nest 12 and TypeScript 6 migration is outstanding; unpatched scanner findings remain. | Schedule framework migration with module-format compatibility tests, monitor upstream advisories, rebuild patched images, and re-scan both architectures. Avoid incompatible blanket transitive overrides. |

## Operational notes

The database image's Debian base changes from 12 to 13 while PostgreSQL stays
on major 15. Before deploying over an existing data volume, take a backup and
validate libc collation versions and indexes using PostgreSQL's collation
upgrade procedure. The tests exercise fresh databases, not existing production
volume upgrades.


Integration tests delete their fixture tables: use a disposable test database
only. No production database was accessed. Local temporary test containers are
removed after validation. No changes were committed, pushed, or deployed.
