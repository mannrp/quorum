# Auth V2 status

**State:** P1 locally accepted; pinned Ubuntu verification pending
**Active work:** verify P1 on Ubuntu; P2 queued
**Branch:** `codex/auth-v2-rewrite`
**Pull request:** `mannrp/quorum#10` (draft)
**Updated:** 2026-08-01

## What works now

Quorum now has one browser authentication path: Better Auth `1.6.25` mounted by public Next at `/api/auth/[...path]`.

- Email/password registration sends verification mail through SMTP/Mailpit.
- Verification links are one-use; replay is rejected.
- Verified users sign in with an opaque host-only HttpOnly `SameSite=Lax` cookie and can sign out.
- A verified user can self-enroll only as Student or Sponsor through `POST /api/v1/enrollment`.
- Next derives identity and verified email from the server session, signs a short-lived assertion, and calls private Go.
- Go verifies the assertion, ignores browser identity/authority fields, provisions through the existing identity service, resolves current PostgreSQL state, and returns the narrow `ViewerBootstrapV1` projection.
- `GET /api/v1/viewer` is private/no-store and excludes email, provider/session identifiers, elevated grants, private profile data, and file URLs.
- Existing product pages temporarily use the private Next `/api/graphql` bridge with the new assertion. Browser-supplied GraphQL remains scheduled for removal in P3.
- Admin is unavailable until MFA/recovery. Legacy Neon, demo persona/reset, bearer verifier, `ADMIN_EMAILS`, browser backend URL, and legacy demo/e2e command paths are removed.

## Current phase board

| Phase | Status | Remaining result |
|---|---|---|
| C0 Cleanup | done | Lean contract, status, implementation plan, and operations guide |
| P1 Authentication cutover and viewer | in review | Local acceptance complete; exact pushed commit must pass pinned Ubuntu |
| P2 Google and account lifecycle | pending | Google, recovery/email changes, explicit linking, and session management |
| P3 Product operation migration | pending | Registered typed operations replace arbitrary browser GraphQL |
| P4 Files and release | pending | Private files, protected deployment, final deletion, and release evidence |

## Latest verified evidence

Verified locally on 2026-08-01:

```text
npm run lint                                      PASS
npm run typecheck                                 PASS
npm run build                                     PASS
npm run test:web                                  PASS (8 files, 26 tests)
npm run test:e2e                                  PASS (handler 2 + Chromium 2; no skips)
npm run test:docker-context                       PASS
cd apps/api && go test ./...                      PASS
service-backed go test -count=1 ./...             PASS (PostgreSQL required; no skips)
```

The service-backed handler flow proves register -> Mailpit delivery -> invalid/expired/replayed verification rejection -> login -> opaque cookie -> raw-token projection -> bearer-reuse denial -> signed Next-to-Go enrollment -> viewer -> refresh -> logout. Database role bootstrap and all eight canonical migrations were verified before it ran. Docker services were pinned PostgreSQL `17.10-alpine3.24` and Mailpit `1.30.0` on loopback-only ports.

Repository scans found no active Neon Auth dependency/configuration, demo identity route, `ADMIN_EMAILS`, browser backend URL, bearer credential use, or browser storage credential use. The only `R2_PUBLIC_URL` references are dormant P4 file configuration and are not returned by the viewer path.

## Real blockers and next work

P1 behavior is locally complete. The sole P1 closure condition is a green pinned Ubuntu workflow on the exact pushed milestone commit. CI now restores runtime-role credentials after rotation tests and runs the service-backed handler plus authenticated Chromium journey with no skip path.

After P1, execute P2, P3, then P4 in `IMPLEMENTATION.md`. Production host/transport, transactional email, and retention choices do not block local P1-P3 work. Admin stays disabled.

`npm audit --omit=dev` most recently reported three high transitive findings in the current Next dependency tree (PostCSS/sharp) with no non-breaking patched Next release offered by npm. There is no longer a nested legacy Better Auth dependency. Recheck before release; do not weaken tests or force a downgrade.
