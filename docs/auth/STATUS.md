# Auth V2 status

**State:** foundations complete; runtime integration not started
**Active work:** P1 ready; product integration has not started
**Branch:** `codex/auth-v2-rewrite`
**Pull request:** `mannrp/quorum#10` (draft)
**Updated:** 2026-07-31

## What the application does today

Auth V2 is not yet usable.

- Next still mounts `@neondatabase/auth` at `/api/auth/[...path]`.
- Login, registration, logout, and account UI still call the legacy Neon client.
- `/api/graphql` still forwards arbitrary browser GraphQL bodies and obtains a Neon JWT.
- Go still verifies Neon JWKS bearer tokens and resolves legacy `auth_user_id` values.
- `ADMIN_EMAILS` and demo-persona identity paths still exist.
- Better Auth, Auth V2 provisioning, the delegated assertion, and the Auth V2 schema are not wired into a runtime request.
- The current Playwright test proves only the anonymous shell, not authenticated behavior.

Green tests therefore prove foundations, not a delivered authentication flow.

## Completed foundations

| Foundation | Result | Evidence |
|---|---|---|
| Containment and local services | Pinned PostgreSQL and Mailpit Compose services, guarded reset, Docker-context protection | commits `0b6d58d`, `b323153` |
| Database delivery | Canonical transactional migrations, role bootstrap, checksums/locking, upgrade/reset/restore and least-privilege tests | Owner-approved; Ubuntu CI subsequently green |
| Provider selection | Better Auth `1.6.25` accepted after PostgreSQL-backed evaluation; experimental harness retired after acceptance | Ubuntu run `30670530686`; commits through `f7018cd` |
| Schema and identity foundation | `better_auth`, product identity/account-state/grant, integration and audit schemas; idempotent provisioning; SQLc generation | Owner-approved; Ubuntu run `30673425384`; commits `6f50e1e` through `185f5d9` |
| Delegated assertion primitive | Server-only Next Ed25519 signer and strict Go verifier; no authority claims; 15-second default and 60-second maximum | commit `2aec098` |

Accepted provider settings to carry into the real integration:

- Password minimum: 29 UTF-16 code units; maximum 128.
- Sessions: 24-hour idle, 7-day absolute, 10-minute recent-auth window.
- Secure host-only signed cookie; raw stored token and bearer reuse denied.
- Explicit account linking; no implicit same-email merge.
- Better Auth schema isolated to `better_auth`.
- Database-backed rate limiting when more than one Next instance is deployed.

Detailed experimental code and duplicated evidence were removed during C0. Git history and the CI run IDs above preserve the audit trail.

## Work board

| Slice | Status | Outcome |
|---|---|---|
| C0 Cleanup | done | Remove retired spike/planning bloat; leave one accurate contract, status, plan, and operations guide |
| P1 Usable login and viewer | pending | Real Better Auth email/password session reaches typed `ViewerBootstrapV1` through Next and Go |
| P2 Complete sign-in lifecycle | pending | Google, verification/reset, logout, session management, linking, and inactive-account denial |
| P3 Protect used product operations | pending | Replace arbitrary browser GraphQL with typed operations and Go authorization for UI features actually in use |
| P4 Files, cutover, and release | pending | Private files, one protected deployment topology, operational checks, and removal of every legacy auth path |

Only one slice is active at a time. Acceptance criteria and commands live beside each slice in `IMPLEMENTATION.md`; there are no separate ceremonial phase gates.

## Open release choices

These do not block P1:

- Production host/topology and its protected Next-to-Go transport.
- Production transactional email provider.
- Initial Admin bootstrap process. Admin stays disabled until MFA/recovery exists.
- File/account retention periods. File and deletion features stay disabled until selected.

## Latest cleanup facts

- Removed the 49-file, 5,722-line provider spike and its synthetic helpers.
- Removed its dedicated runner/configuration and 90 spike-only npm packages.
- Removed duplicated long-form audit/evidence documents.
- Removed the uncommitted, unwired principal-resolution experiment; it will be rebuilt only inside P1's real vertical route.
- Retained migrations, database safety, identity provisioning, and the compact assertion signer/verifier.
Cleanup verification passed:

- stale-reference, encoding, whitespace, and lockfile consistency checks;
- lint and typecheck;
- production build;
- 4 maintained web tests and the anonymous Playwright smoke;
- Docker-context sentinel;
- all Go packages without service requirements;
- all PostgreSQL migration/reset/role/identity/dump/restore tests with integration required.

`npm audit --omit=dev` reports seven existing production findings through legacy `@neondatabase/auth` and the current Next dependency tree. There is no deployed Auth V2 surface, but these findings block release. P1 must use a patched Better Auth/Next set; P4 removes Neon entirely.