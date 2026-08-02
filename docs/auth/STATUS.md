# Auth V2 status

**State:** P1, P2, and P3 complete; P4 release evidence remains
**Active work:** P4 deployment and release evidence
**Branch:** `codex/auth-v2-rewrite`
**Pull request:** `mannrp/quorum#10` (draft)
**Updated:** 2026-08-02

## What works now

Quorum now has one browser authentication path: Better Auth `1.6.25` mounted by public Next at `/api/auth/[...path]`.

- Email/password registration sends verification mail through SMTP/Mailpit.
- Google sign-in uses one exact callback and the same verified Student/Sponsor enrollment path; implicit same-email linking is disabled.
- Verification links are one-use; replay is rejected.
- Verified users sign in with an opaque host-only HttpOnly `SameSite=Lax` cookie and can sign out.
- A verified user can self-enroll only as Student or Sponsor through `POST /api/v1/enrollment`.
- Next derives identity and verified email from the server session, signs a short-lived assertion, and calls private Go.
- Go verifies the assertion, ignores browser identity/authority fields, provisions through the existing identity service, resolves current PostgreSQL state, and returns the narrow `ViewerBootstrapV1` projection.
- `GET /api/v1/viewer` is private/no-store and excludes email, provider/session identifiers, elevated grants, private profile data, and file URLs.
- Home, public team/project lists and details, and public profiles use signed anonymous registered operations with bounded inputs and narrow projections. Hidden teams, draft projects, inactive profiles, application details, permissions, durable file URLs, resumes, email, and auth identifiers are excluded.
- All enabled browser workflows use bounded authenticated registered operations. The browser GraphQL client, query constants, and `/api/graphql` forwarding route are deleted.
- Admin is unavailable until MFA/recovery. Legacy Neon, demo persona/reset, bearer verifier, `ADMIN_EMAILS`, browser backend URL, and legacy demo/e2e command paths are removed.

## Current phase board

| Phase | Status | Remaining result |
|---|---|---|
| C0 Cleanup | done | Lean contract, status, implementation plan, and operations guide |
| P1 Authentication cutover and viewer | done | Local and pinned Ubuntu acceptance green |
| P2 Google and account lifecycle | done | Google, recovery/email changes, explicit linking, and session management |
| P3 Product operation migration | done | Registered typed operations replace arbitrary browser GraphQL |
| P4 Files and release | in progress | Protected deployment, final deletion, and release evidence |

## Latest verified evidence

Verified locally on 2026-08-02:

```text
npm run lint                                      PASS
npm run typecheck                                 PASS
npm run build                                     PASS
npm run test:web                                  PASS (14 files, 94 tests)
npm run test:e2e                                  PASS (handler 10 + Chromium 5; no skips)
npm run test:docker-context                       PASS
cd apps/api && go test ./...                      PASS
service-backed go test -count=1 ./...             PASS (PostgreSQL required; no skips)
```

The service-backed handler flow proves register -> Mailpit delivery -> invalid/expired/replayed verification rejection -> login -> opaque cookie -> raw-token projection -> bearer-reuse denial -> signed Next-to-Go enrollment -> viewer -> refresh -> logout. Database role bootstrap and all eight canonical migrations were verified before it ran. Docker services were pinned PostgreSQL `17.10-alpine3.24` and Mailpit `1.30.0` on loopback-only ports.

Repository scans found no active Neon Auth dependency/configuration, demo identity route, `ADMIN_EMAILS`, browser backend URL, bearer credential use, browser storage credential use, browser GraphQL client, query text, or `/api/graphql` forwarding route. `R2_PUBLIC_URL` configuration and durable signing output are removed.

## Real blockers and next work

P2 is complete. Account Security now provides password change, two-mailbox email change, explicit Google linking, projected session listing, revoke-one/revoke-others/logout-all, and credential-free cross-tab invalidation. Service-backed tests prove enumeration-safe reset, one-use email links and replay denial, password cookie rotation, 24-hour idle and 7-day absolute expiry, refresh preservation of authentication context, current-state inactive-account denial, and no reusable credential projection. The exact local acceptance above passed with pinned PostgreSQL `17.10-alpine3.24` and Mailpit `1.30.0`.

P3 is complete. Public discovery, viewer shell/account, Teams, Projects, inbox, and notifications are registered typed operations; browser-supplied GraphQL is deleted. P4 remains: production image/socket deployment and release evidence. No file feature is enabled; the dormant R2 signer and public URL configuration are removed rather than shipped. Admin stays unavailable until MFA/recovery.
`npm audit --omit=dev` most recently reported three high transitive findings in the current Next dependency tree (PostCSS/sharp) with no non-breaking patched Next release offered by npm. There is no longer a nested legacy Better Auth dependency. Recheck before release; do not weaken tests or force a downgrade.
