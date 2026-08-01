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
| P1 Usable login and viewer | in progress | Real Better Auth email/password session reaches typed `ViewerBootstrapV1` through Next and Go |
| P2 Complete sign-in lifecycle | pending | Google, verification/reset, logout, session management, linking, and inactive-account denial |
| P3 Protect used product operations | pending | Replace arbitrary browser GraphQL with typed operations and Go authorization for UI features actually in use |
| P4 Files, cutover, and release | pending | Private files, one protected deployment topology, operational checks, and removal of every legacy auth path |

Only one slice is active at a time. Acceptance criteria and commands live beside each slice in `IMPLEMENTATION.md`; there are no separate ceremonial phase gates.

## Finish-plan defaults

The final execution plan was expanded in place on 2026-07-31:

- P1 directly replaces Neon Auth; there is no long-lived dual-auth or spike route.
- Current package targets are Better Auth `1.6.25`, PostgreSQL client `8.22.0`, Nodemailer `9.0.3`, and Next `16.2.12`, subject to clean install/build/audit evidence when implemented.
- Existing Go GraphQL may remain private internally, but browser query text is temporary and must be replaced by registered operations in P3.
- Admin and unused Professor invitation features remain disabled instead of blocking ordinary-user Auth V2.
- The default release topology is one host with only Next public and a restrictive Unix-domain socket to Go; use mTLS only if the selected host cannot support that shape.

P1-P3 are development/test integration and are not production-releaseable until P4 completes the transport, provider smoke, file, backup/rollback, and deletion checks.
## Open release choices

These do not block P1:

- Production host/topology and its protected Next-to-Go transport.
- Production transactional email provider.
- Initial Admin bootstrap process. Admin stays disabled until MFA/recovery exists.
- File/account retention periods. File and deletion features stay disabled until selected.

## Latest verified work

P1.1 is implemented and the first P1.2 runtime seam is mounted:

- Next 16.2.12, Better Auth 1.6.25, pg 8.22.0, and Nodemailer 9.0.3 are direct exact dependencies.
- The Next 16 ESLint CLI migration, typecheck, and production build pass.
- Server configuration rejects weak secrets, unsafe origins, non-PostgreSQL URLs, public-schema fallback, implicit same-email linking, and insecure production cookies.
- Better Auth uses the canonical origin, exact trusted origin, host-only HttpOnly cookie, accepted password/session limits, database rate limiting, and a PostgreSQL connection restricted to better_auth.
- The existing /api/auth/[...path] now mounts the real Better Auth handler. Mail callbacks use the server-only SMTP adapter.
- Login, registration, onboarding session lookup, and logout now use the Better Auth browser client. Registration stops after verification mail instead of performing the legacy profile mutation.
- The real PostgreSQL/Mailpit handler test covers register, delivery, one-use verification, login, opaque host-only HttpOnly cookie, logout, and wrong-origin denial.
- GraphQL identity, Go middleware, enrollment/viewer, and legacy Neon dependencies are not cut over yet; the product flow is therefore still incomplete.

Verified 2026-07-31:

    npm run lint                         PASS
    npm run typecheck                    PASS
    npm run build                        PASS
    npm run test:web                     PASS (5 files, 14 tests)
    npm run test:e2e                     PASS (Chromium, 1 test)
    npm run test:integration             PASS (PostgreSQL + Mailpit, 2 tests)
    npm run test:docker-context          PASS

npm audit --omit=dev still reports seven production findings. The critical Better Auth findings are confined to the nested legacy @neondatabase/auth dependency that P1.4 removes. Current Next 16.2.12 also carries transitive PostCSS/sharp advisories with no non-breaking patched Next release reported by npm. These remain release blockers, not skipped checks.
