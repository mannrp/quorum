# Auth V2 implementation and finish plan

This is the only Auth V2 delivery plan. `STATUS.md` states current reality and `AUTH_V2_CONTRACT.md` contains the durable rules. Do not create another roadmap, gate matrix, benchmark plan, or acceptance framework.

## Definition of finished

Auth V2 is finished when a fresh browser can register or sign in with email/password or Google, use every enabled Quorum workflow, manage its account and sessions, and access private files without any legacy identity path.

The repository must then have:

- one Better Auth configuration and one browser auth client;
- one opaque host-only session cookie;
- one short-lived Next-to-Go assertion path;
- current-state Go principal and authorization checks;
- registered browser operations only - no browser-supplied GraphQL;
- private object storage;
- only Next exposed publicly;
- no Neon Auth, legacy bearer verifier, `ADMIN_EMAILS`, demo identity, public file URL, or browser-visible Go endpoint;
- green local, service-backed, browser, build, and pinned Ubuntu checks.

Disabled features do not need speculative implementation, but their old routes and authority paths must be unreachable.

## Delivery rules

- One phase is active at a time and ends in working behavior.
- Start each behavior with a focused failing test against the real configuration or route.
- Prefer explicit route modules and small functions. Add an interface only at a real external boundary.
- Reuse the existing Go domain/resolver logic while it remains correct; do not rewrite the product alongside authentication.
- Keep internal GraphQL if useful, but the browser may send only a registered operation ID and typed variables.
- Commit substantial green milestones. Update `STATUS.md` after each phase, not after every test.

## Phase summary

| Phase | Status | Product result |
|---|---|---|
| C0 Cleanup | done | Retired spike/planning framework removed; lean sources of truth established |
| P1 Authentication cutover and viewer | done | Better Auth replaces Neon and a verified user reaches `ViewerBootstrapV1` |
| P2 Google and account lifecycle | in progress | Both sign-in methods, recovery, linking, and session management work |
| P3 Product operation migration | pending | Every enabled UI workflow uses registered operations and Go authorization |
| P4 Files and release | pending | Private files, protected deployment, legacy deletion, and release evidence |

## P1 - Authentication cutover and viewer

**End state:** Better Auth is the repository's only browser authentication implementation. A Student or Sponsor can register, verify email through Mailpit, sign in, complete enrollment, load their viewer, refresh, and sign out. Existing product pages may still use the temporary internal GraphQL bridge, but Neon identity is gone.

### P1.1 Dependency and configuration baseline

Use these current stable versions, checked 2026-07-31:

- `better-auth@1.6.25`
- `pg@8.22.0`
- `nodemailer@9.0.3`
- Next `16.2.12` with its matching ESLint configuration

Work:

1. Upgrade Next first in a standalone tested commit; replace deprecated `next lint` with the ESLint CLI.
2. Add Better Auth, PostgreSQL, and mail packages as direct runtime dependencies.
3. Re-run `npm audit --omit=dev`; resolve findings affecting enabled code. Do not use `audit fix --force` or accept a downgrade.
4. Add one server-only configuration module with validated environment input, canonical origin, exact trusted origins, the `better_auth` schema, accepted password/session limits, explicit account-linking policy, and fail-closed startup.
5. Update env examples with names actually consumed. Secrets remain server-only.

Tests:

- Configuration rejects missing/weak secret, wrong origin, production-insecure cookie, invalid session limits, automatic same-email linking, and schema fallback to `public`.
- A catalog test proves accepted auth objects exist only in `better_auth` and the auth runtime role cannot read or mutate product policy tables.
- Lint, typecheck, build, web tests, and dependency audit are clean for the enabled dependency set.

### P1.2 Real email/password and mail flow

Work:

1. Mount Better Auth at the existing `/api/auth/[...path]` route; do not add a second spike route.
2. Replace `lib/neon-auth.ts` and all auth UI imports with one Better Auth client.
3. Implement register, verification action page, login, logout, and safe relative return paths.
4. Send verification mail through one Nodemailer adapter. Local/test uses Mailpit.
5. Keep verification/reset values out of logs, screenshots, evidence, third-party resources, and browser storage.

Tests against the actual handler:

- Register -> Mailpit delivery -> one-use verification -> login -> signed opaque cookie -> logout.
- Wrong origin, wrong content type, missing CSRF/Fetch Metadata, unverified login, invalid/expired/replayed verification, external return URL, raw database token, bearer token, and browser-readable credential reuse fail.
- Cookie is host-only and HttpOnly, uses `SameSite=Lax`, and is `Secure` in production.
- Auth/session responses contain projected fields only.

### P1.3 Enrollment, principal, and viewer

Use explicit endpoints, not a generic RPC framework:

- Next: `POST /api/v1/enrollment`, `GET /api/v1/viewer`
- Go private: `POST /internal/v1/enrollment`, `GET /internal/v1/viewer`

Flow:

1. After verification, the user chooses only `STUDENT` or `SPONSOR`.
2. Next derives realm, stable Better Auth user ID, verified email, authentication time/method, and device context from the server session. It ignores browser identity/email/authority fields.
3. Next signs the existing 15-second assertion and sends the requested self-service role separately over the protected internal call.
4. Go validates the assertion, validates the allowed role, and calls the existing idempotent identity provisioning service.
5. Go resolves `(realm, Better Auth user ID)` against current identity/account/grant state and returns the exact `ViewerBootstrapV1` projection.
6. Next returns `private, no-store` and never returns the assertion or provider/session identifiers.

Keep the implementation small:

- one principal application package;
- one SQLc query for current binding/account/self-service roles;
- one HTTP adapter for the two endpoints;
- no generated client, policy DSL, or generalized operation bus.

Tests:

- New enrollment, retry, concurrent retry, returning user, Student/Sponsor validation, same-email collision, unknown/ambiguous/unlinked/stale binding, and suspended/deactivated/deleted state.
- Viewer excludes email, auth/provider ID, session values, Professor/Admin grants, private profile fields, and file URLs.
- Assertion suite covers missing/malformed token, browser spoof, wrong algorithm/type/key/issuer/audience, early/expired/overlong token, key overlap, replay after expiry, anonymous confusion, and authority claims.
- Cancellation, deadline, and correlation ID cross the boundary; no automatic retry occurs for enrollment.

### P1.4 Remove legacy authentication

Before P1 closes:

- remove `@neondatabase/auth` and its nested vulnerable Better Auth copy;
- delete Neon server/client modules and `NEON_AUTH_*` variables;
- replace Go's Neon JWKS verifier/middleware with the internal assertion middleware;
- resolve existing GraphQL users through the new principal context;
- remove `ADMIN_EMAILS` bootstrap and make `/admin` unavailable;
- remove demo persona/reset identity paths;
- remove browser-visible backend URL fallbacks.

The temporary `/api/graphql` bridge may remain only for existing pages during P3. It is same-origin, server-to-private-Go, uses the new assertion, and is explicitly not release-ready because it still accepts browser query text.

P1 acceptance command set:

```sh
npm run lint
npm run typecheck
npm run build
npm run test:web
npm run test:e2e
npm run test:docker-context
cd apps/api && go test ./...
```

Also run the PostgreSQL/Mailpit integration flow with missing infrastructure configured to fail, not skip. End P1 with one Chromium test for register -> verify -> enroll -> viewer -> refresh -> logout.

## P2 - Google and account lifecycle

**End state:** users can choose Google or email/password and safely manage credentials, linked accounts, and sessions.

### P2.1 Google and linking

1. Configure Better Auth Google using the canonical origin and one exact callback.
2. Reintroduce a deterministic local OIDC provider only for the real route test.
3. Implement Google login/cancellation/error UI and reviewed relative redirects. A first-time Google user continues through the same verified Student/Sponsor enrollment flow as email/password.
4. Implement explicit link/unlink behind recent authentication.
5. Never automatically link merely because emails match. Never use the Google subject as the Quorum identity key.

Tests:

- State, PKCE, nonce where applicable, exact callback, provider denial, missing/wrong cookie, wrong origin, expiry, replay, and encoded external redirects.
- First Google login provisions once; returning login resolves the same user after email/name change.
- Same-email different account collides safely; explicit link/unlink and last-login-method protection work.

### P2.2 Password, email, and sessions

1. Implement forgot/reset password, password change, email change/re-verification, session list, revoke-one, revoke-others, and logout-all using Better Auth APIs.
2. Preserve real `authenticated_at`, `amr`, and assurance across refresh/rotation.
3. Clear viewer/query caches on logout, account change, revocation response, and cross-tab sign-out.
4. Go denies inactive accounts on every request. Do not build a generic worker until a real product operation can suspend/deactivate an account.
5. Add database-backed rate limiting when tests or the selected runtime use multiple Next instances; otherwise schedule it at P4 before horizontal deployment.

Tests:

- Mailpit delivery and one-use/expiry/replay for reset and email change.
- 24-hour idle, 7-day absolute, 10-minute recent-auth, session rotation, concurrent revoke, stale cookie, and cross-tab behavior.
- Enumeration-safe errors and no credential/action value in URL history after exchange, logs, JSON, or storage.

P2 closes with browser flows for Google, password reset, session revocation, and inactive-account denial.

## P3 - Product operation migration

**End state:** the browser cannot submit GraphQL text. Every enabled page uses a registered operation with typed variables, explicit projection, and current-state Go authorization.

### Transport shape

Keep Go GraphQL private to minimize the rewrite. Replace `/api/graphql` with a same-origin registered-operation route:

```text
POST /api/v1/operations/{operationId}
body: validated variables only
```

Next owns a small static map from operation ID to reviewed internal document and variable parser. Browser code imports operation IDs and TypeScript input/output types. Do not add code generation unless manual drift becomes an actual problem.

For every operation:

- Next rejects unknown ID, query text, extra variables, identity/role fields, wrong method/content type/origin, and oversized body.
- Go resolves the current principal and authorizes root plus nested fields.
- Lists have explicit bounds and responses expose only required fields.

### Migration order

1. **Public discovery:** home, team/project lists and detail, public profile. Use anonymous assertions and approved public projections.
2. **Viewer shell:** auth state, shell counts, dashboard context, `me`, onboarding/profile update, account self-service.
3. **Teams:** create/update team, membership view, join request/cancel/respond, invite/cancel/respond, member removal/promotion/leave.
4. **Projects:** create/edit project, project claim/review if enabled, applications, withdraw/respond/offer workflow.
5. **Communication:** inbox, user search, messages/send/read, notifications/read, dashboard aggregates.
6. **Files:** leave upload/download buttons disabled until P4 rather than returning public URLs.
7. **Admin:** keep the page and operations unavailable. Admin is a later product feature requiring MFA/recovery before reactivation.

Each numbered group is a separate tested commit. Delete its old browser query strings as it migrates. When the last group is done, delete `/api/graphql`, `lib/graphql.ts`, browser GraphQL configuration, and any public Go GraphQL ingress.

Acceptance per group:

- allowed role/relationship/resource-state cases pass;
- anonymous, wrong role, inactive account, cross-user IDOR, stale membership/ownership, invalid transition, excessive page/amount, forged identity/role, forbidden nested field, and duplicate/concurrent mutation fail safely;
- browser test covers the actual workflow;
- query counts are bounded for that workflow, without a separate synthetic benchmark program.

P3 closes only when repository and browser-network scans show no browser GraphQL document and no browser-reachable Go endpoint.

## P4 - Private files and release

**End state:** all enabled Quorum functionality runs on Auth V2 in one production-shaped, supportable deployment.

### P4.1 Files

1. Migrate legacy URL columns additively to private object keys and metadata.
2. Implement typed upload intent, completion, download, replacement, and deletion operations only for file features present in enabled UI.
3. Go checks current owner/member/role/resource state for every operation.
4. Use short expiries, exact bucket/prefix/content type/size, randomized keys, and private bucket policy.
5. Remove `publicUrl` from API types, UI, database writes, and configuration.

Tests cover wrong owner/team/project, guessed key, expired/replayed grant, MIME/size mismatch, replacement cleanup, private bucket policy, and real R2 smoke before release.

### P4.2 One deployment topology

Use the simplest accepted first shape: one host with separate Next and Go containers, a shared restrictive Unix-domain socket for Next-to-Go traffic, PostgreSQL over its private/TLS path, and only the HTTPS reverse proxy/Next port published.

Work:

- production Dockerfiles, non-root users, health/readiness, graceful shutdown, and `.dockerignore` verification;
- restrictive socket ownership/mode and a Node socket client used only by server code;
- serialized migration release job;
- production secret inventory and assertion-key overlap/retirement procedure;
- backup/restore, compatible rollback, logs/metrics without secrets;
- real Google, transactional-email, and R2 test accounts.

If the eventual host cannot provide the one-host socket shape, replace only this transport step with mTLS and record the concrete host reason in `STATUS.md`; do not reopen a vendor bake-off.

### P4.3 Final deletion and audit

Delete or prove absent:

- Neon Auth package, modules, environment variables, JWKS verifier, and legacy `auth_user_id` authority;
- `ADMIN_EMAILS`, demo identity/reset routes, browser backend URLs, `/api/graphql`, browser GraphQL text, public Go/database ports;
- public file URLs and reusable credentials in responses/logs/storage;
- temporary Auth V2 flags and dual-auth branches;
- unused schemas, helpers, tests, dependencies, and documentation made obsolete by cutover.

Release verification:

- clean install, lint, typecheck, production build, web/Go unit tests, PostgreSQL/Mailpit integration, Chromium flows, Docker-context/image inspection, migrations/restore/rollback, assertion rotation, transport tamper/plaintext rejection, and real Google/email/R2 smoke;
- `npm audit --omit=dev` has no applicable high/critical finding in enabled runtime code;
- pinned Ubuntu CI passes on the exact release commit;
- a fresh browser completes every enabled workflow with Auth V2 only.

When these checks pass, update `STATUS.md` to `complete`, make the pull request ready, and merge. There is no separate benchmark or ceremonial gate after P4.

## Deliberately out of scope

These require a separate product request, not Auth V2 completion:

- re-enabling Admin (requires MFA, recovery, and a bootstrap policy);
- Professor invitation machinery not used by the enabled UI;
- multi-provider support beyond Google and email/password;
- generic workflow/worker platforms;
- GraphQL-versus-HTTP benchmarks without a measured production problem;
- authorization and retention workflows for disabled features.
