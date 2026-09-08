# Quorum contributor rules

These rules apply to the repository. Keep changes small, readable, and tied to a working product path.

## Read before auth work

Read, in order:

1. `docs/auth/STATUS.md` - what is true now.
2. `docs/auth/AUTH_V2_CONTRACT.md` - durable security rules.
3. The active slice in `docs/auth/IMPLEMENTATION.md` - what to build next.
4. `docs/auth/OPERATIONS.md` only for database, Docker, CI, or deployment work.

If code and docs disagree, report the discrepancy in `STATUS.md` and fix the source of truth. Do not add another planning document.

## How to work

- Work on the single active slice in `IMPLEMENTATION.md`.
- Start behavior changes with a focused failing test.
- Prefer one end-to-end vertical path over disconnected frameworks or speculative abstractions.
- Run the focused tests and the slice's listed acceptance commands.
- Keep `STATUS.md` concise: current capability, latest verified commands, and real blockers only. Git history is the detailed log.
- Commit substantial tested milestones. Preserve unrelated user changes.

## Security boundaries

- Browser authentication is owned by public Next.js. Product authorization is owned by private Go using current PostgreSQL state.
- The browser never supplies authoritative identity, email, role, account state, ownership, approval, or capability data.
- Browser code never calls Go, PostgreSQL, object storage, or a Data API directly.
- Browser credentials are opaque `Secure`, `HttpOnly`, host-only cookies. Never expose reusable credentials in JSON, HTML, URLs, logs, analytics, screenshots, or browser storage.
- Use maintained authentication and JOSE libraries. Do not implement passwords, OAuth, sessions, token generation, or recovery cryptography from scratch.
- Next-to-Go assertions are short-lived and contain identity context only-never roles, permissions, email authority, or ownership.
- Go resolves the product user and permissions from current database state and fails closed for unknown, inactive, stale, or ambiguous identities.
- Browser-facing server operations are typed and allowlisted. Do not forward arbitrary GraphQL or URLs.
- Only Next is public. Production Next-to-Go traffic requires a restrictive Unix socket, mTLS, or another reviewed confidential and integrity-protected transport.
- Better Auth objects stay in `better_auth`, never `public` or Supabase `auth`.
- Canonical SQL migrations stay in `apps/api/migrations`; never create a second migration history or edit an applied migration.
- Files stay private and require authorization for each short-lived access grant.
- Admin remains disabled until MFA and recovery are implemented and tested.
- Security tests fail when required infrastructure is unavailable; they are not skipped or weakened.

## Repository care

- Use `npm run db:generate` after changing SQL queries; never hand-edit generated sqlc files.
- Keep transports thin. Domain packages do not import Next, HTTP, gqlgen, Better Auth, or generated sqlc rows.
- Server secrets are never prefixed `NEXT_PUBLIC_`.
- Keep `.env` files, credentials, keys, dumps, test mail containing secrets, and personal data out of git.
- Verify `.dockerignore` whenever build contexts change.
- Use additive migrations and recoverable operations. Never reset or delete a non-local database.

## Baseline commands

```sh
npm run lint
npm run typecheck
npm run build
npm run test:web
npm run test:e2e
npm run test:docker-context
cd apps/api && go test ./...
```

Use the service-backed commands in `docs/auth/OPERATIONS.md` when the active slice touches PostgreSQL or email.