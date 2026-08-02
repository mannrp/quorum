# Auth V2 operations

This file documents commands and constraints that exist now. Product work belongs in `IMPLEMENTATION.md`.

## Local services

Requirements: the Node version in `.nvmrc`, the Go version in `apps/api/go.mod`, Docker, and npm.

```sh
npm ci
npm run infra:up
npm run infra:status
```

Compose exposes PostgreSQL and Mailpit on loopback only:

- PostgreSQL: `127.0.0.1:54322`
- SMTP: `127.0.0.1:1025`
- Mailpit UI/API: `127.0.0.1:8025`

Stop services with:

```sh
npm run infra:down
```

Local-only example values are in `auth-v2.env.example`. Do not copy those credentials to any shared or hosted environment.

## Database lifecycle

Canonical migrations live in `apps/api/migrations`.

```sh
npm run db:bootstrap-roles
npm run db:migrate
npm run db:generate
```

Use a provider/operator connection only for role bootstrap. Use the migrator role for migrations and application runtime roles for normal processes.

Local reset is deliberately separate and guarded:

```sh
npm run db:init:local
npm run db:reset:local
```

Reset requires the operator `LOCAL_TEST_DATABASE_URL`, the scoped `MIGRATOR_DATABASE_URL`, and a matching instance marker. Both connections must target the same guarded local database; remote, ambiguous, or production-shaped targets fail closed.

Migration rules:

- Add a new migration; never edit an applied migration.
- Migrations are transactional, checksum-verified, ordered, and serialized.
- Application startup never auto-migrates.
- Run `npm run db:generate` after query changes and commit generated output.
- Release migrations must support the serving and rollback application versions.

## Service-backed verification

Start Compose, then set local-only URLs for the test process:

```powershell
$env:QUORUM_TEST_DATABASE_URL='postgres://quorum_operator:quorum-local-operator-only@127.0.0.1:54322/quorum_dev?sslmode=disable'
$env:QUORUM_MIGRATION_TEST_DATABASE_URL=$env:QUORUM_TEST_DATABASE_URL
$env:QUORUM_ROLE_TEST_DATABASE_URL=$env:QUORUM_TEST_DATABASE_URL
$env:QUORUM_REQUIRE_INTEGRATION='true'
$env:QUORUM_POSTGRES_CONTAINER='quorum-dev-postgres-1'
cd apps/api
go test -count=1 ./...
```

Tests that require PostgreSQL must fail rather than skip when `QUORUM_REQUIRE_INTEGRATION=true`.

## Runtime configuration categories

Exact variable names are introduced with the code that consumes them.

Next will require:

- canonical public origin and trusted origins;
- Better Auth database connection and secret;
- Google credentials and exact callback when Google is enabled;
- SMTP configuration;
- private Go endpoint;
- internal assertion private key and active key ID;
- session limits and feature flag.

Go will require:

- application runtime database URL;
- exact assertion issuer, audience, type, and bounded public key set;
- request/deadline limits;
- private object-storage configuration only when files are enabled.

Secrets remain server-only. Production must reject dangerous legacy variables at cutover rather than silently accepting ambiguous behavior.

## Deployment boundary

Only Next receives public traffic.

```text
Internet -> HTTPS proxy/platform -> Next
                              -> protected private Go
                                   -> PostgreSQL
                                   -> private object storage (when enabled)
```

Next-to-Go production transport is one of:

- restrictive Unix-domain socket on one host;
- mTLS between services; or
- a provider transport explicitly reviewed as confidential and integrity-protected.

A plain HTTP service merely described as "private" is not sufficient. Do not publish Go or PostgreSQL ports.

## Release checklist

Before cutover:

1. All active-slice acceptance tests and repository baseline commands pass on the release commit.
2. PostgreSQL backup/restore and forward migration are tested.
3. Production secrets and key rotation are configured without logging values.
4. Real Google and transactional-email smoke tests pass if those providers are enabled.
5. Only Next is public and the Next-to-Go transport is verified.
6. Viewer/session responses are private and no-store; no reusable credential appears in output or logs.
7. Legacy Neon routes/verifier, arbitrary GraphQL forwarding, demo identity, `ADMIN_EMAILS`, public file URLs, and browser-visible backend origins are absent.
8. Rollback uses a compatible image or disables the affected feature; it never restores weaker authentication.

Host, email, Admin bootstrap, and retention choices remain listed in `STATUS.md` until selected. Do not add vendor comparison documents before a release environment is actually being chosen.