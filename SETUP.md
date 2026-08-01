# Local setup

The product still contains legacy Neon authentication while Auth V2 is being integrated. Do not add new Neon-specific behavior.

For the current Auth V2 local services and database commands, use [`docs/auth/OPERATIONS.md`](docs/auth/OPERATIONS.md). Current implementation truth is in [`docs/auth/STATUS.md`](docs/auth/STATUS.md).

## Prerequisites

- Node.js version from `.nvmrc`
- npm version from `package.json`
- Go version from `apps/api/go.mod`
- Docker

## Install and start local dependencies

```sh
npm ci
npm run infra:up
npm run infra:status
```

PostgreSQL and Mailpit bind to loopback only. Local-only example values are in `auth-v2.env.example`; never reuse them outside the local Compose environment.

## Database

```sh
npm run db:bootstrap-roles
npm run db:migrate
npm run db:generate
```

Use `db:init:local` and `db:reset:local` only with the guarded local test database described in the operations guide.

## Applications

```sh
npm run dev:api
npm run dev:web
```

Legacy screens may still require the ignored environment files documented by their startup errors. Those variables are temporary and must disappear during Auth V2 cutover.

## Verification

```sh
npm run lint
npm run typecheck
npm run build
npm run test:web
npm run test:e2e
npm run test:docker-context
cd apps/api && go test ./...
```

For PostgreSQL-backed tests, use the explicit service variables in `docs/auth/OPERATIONS.md` so missing infrastructure fails instead of skipping.