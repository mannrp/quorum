# Auth V2 implementation

This is the only Auth V2 delivery plan. Build one working vertical slice at a time. Do not add a separate roadmap, gate matrix, benchmark plan, or speculative platform.

`STATUS.md` says what exists. `AUTH_V2_CONTRACT.md` defines the rules. This file says what to build next and how to prove it.

## Working rules

- Only one slice is active.
- A slice ends in usable behavior, not disconnected infrastructure.
- Add a failing test for the behavior being introduced, then the smallest implementation.
- Test actual routes/configuration. Do not rebuild generic acceptance simulators.
- Keep dormant features disabled instead of implementing their future security machinery early.
- Update `STATUS.md` with concise results and exact commands when a slice changes state.

## C0 - Cleanup

**Status:** done

**Outcome:** A readable repository with one accurate Auth V2 plan and no retired spike framework.

Work:

- Delete the Better Auth acceptance-spike directory, runners, configs, synthetic helpers, and spike-only dependencies.
- Delete duplicated decision, verification, historical audit, and evidence documents after preserving concise accepted results in `STATUS.md` and the durable rules in the contract.
- Remove the unwired principal experiment started under the old plan.
- Rewrite `AGENTS.md`, auth docs, root README, and setup guidance so no obsolete task/gate reference remains.
- Keep the canonical migrations, database safety work, identity provisioning, and compact assertion signer/verifier.

Acceptance:

- Repository search finds no deleted-document, old A/G gate, spike-runner, or synthetic-spike references.
- `npm install --package-lock-only` reports a consistent workspace.
- `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:web`, `npm run test:e2e`, `npm run test:docker-context`, and `cd apps/api && go test ./...` pass.
- Service-backed Go tests pass with `QUORUM_REQUIRE_INTEGRATION=true`.
- Cleanup is committed separately before product integration begins.

## P1 - Usable email/password login and viewer

**Status:** pending after C0

**User outcome:** A new Student or Sponsor can register, verify email through Mailpit, sign in, refresh, and see their own viewer bootstrap through Auth V2.

Build only:

1. Add exact `better-auth@1.6.25`, PostgreSQL adapter dependencies, and the chosen mail package as runtime dependencies. Move Next to a supported patched release and remove audit findings that affect the enabled runtime.
2. Create one production-shaped Better Auth configuration using the existing `better_auth` schema and accepted settings from `STATUS.md`.
3. Replace the auth route/client behind one server-controlled Auth V2 flag that defaults off in production until P4. Do not create a separate demo/spike route.
4. Implement registration, email verification, login, logout, and the accepted secure opaque cookie. Store only the allowed Student/Sponsor enrollment choice.
5. Add one typed registration-completion call that lets Go idempotently bind/provision the verified Better Auth user. Go validates the self-service role; browser identity/email values are ignored.
6. Wire the existing short-lived assertion signer/verifier into one private Next-to-Go route.
7. Implement current-state principal lookup and `ViewerBootstrapV1`. Keep it in a small application package; add an adapter only where a real dependency boundary needs one.
8. Add `/api/v1/viewer` as a same-origin typed BFF route with exact origin/CSRF, deadline, correlation, body, and `private, no-store` handling.

Do not build:

- Google, MFA, Admin, invitations, a generic RPC/client generator, a generic worker, public GraphQL hardening, files, provider comparisons, or performance infrastructure.

Acceptance:

- Real PostgreSQL/Mailpit handler test covers register -> verification -> login -> provisioning -> viewer -> logout.
- Password hash and opaque session remain only in `better_auth`; raw database session values and bearer reuse fail.
- Cookie is host-only, HttpOnly, Secure in production, and not present in response JSON or browser storage.
- Wrong origin/CSRF/content type, unverified email, unknown binding, stale identity, inactive account, fabricated browser headers, and arbitrary operation/body all fail closed.
- Viewer response exactly matches the contract and excludes auth/provider IDs, email, session data, privileged grants, private profile fields, and file URLs.
- Assertion tests cover valid, malformed, wrong algorithm/type/key/issuer/audience, early, expired, overlong, anonymous confusion, and forbidden authority claims.
- One browser test proves the complete user flow; baseline and service-backed commands pass.

## P2 - Google and account lifecycle

**Status:** pending after P1

**User outcome:** Users can choose Google or email/password and safely manage their own sessions and credentials.

Build only:

- Google login through Better Auth with the exact configured callback.
- Explicit linking/unlinking with recent authentication and no automatic same-email merge.
- Password reset/change, email change and re-verification, session list/revoke, logout-all, and cross-tab logout/cache clearing.
- Immediate Go-side denial for suspended/deactivated/deleted accounts. Add a durable session-revocation outbox consumer only because this slice creates that real cross-boundary lifecycle need.
- Database-backed rate limiting if the deployed/test topology runs multiple Next instances; otherwise keep the interface simple and add it in P4.

Acceptance:

- Deterministic OAuth test covers state, PKCE, nonce where applicable, exact callback, denial, wrong origin/cookie, expiry, replay, and same-email collision.
- Mailpit tests cover real verification, reset, and change messages without recording secret values.
- Idle/absolute expiry, rotation, recent-auth, session listing/revocation, linking collisions, duplicate events, and inactive-account denial are tested against actual routes.
- Real Google and production-email smoke remain release checks, not CI secrets.

## P3 - Protect product operations actually used by the UI

**Status:** pending after P2

**User outcome:** Signed-in users can use Quorum features through explicit authorized operations; the browser can no longer submit arbitrary GraphQL.

Work:

1. Inventory the operations invoked by current pages.
2. Migrate them in small related groups to registered operation IDs and typed inputs.
3. For each group, write the role/relationship/resource-state table and Go authorization tests before exposing it.
4. Return explicit minimal projections and enforce pagination/amount/deadline limits where applicable.
5. Remove each legacy GraphQL path when its final caller migrates; delete the arbitrary proxy when no callers remain.
6. Keep Professor/Admin operations disabled until their exact product policy is chosen. Implement Admin MFA/recovery immediately before enabling Admin-not before ordinary authorization work.

Acceptance for each group:

- Anonymous, wrong-role, inactive-account, cross-user/IDOR, stale relationship, invalid state transition, excessive amount/page, and forged identity/role inputs fail.
- Allowed cases pass using current database state.
- Nested/private fields are not exposed.
- Browser tests cover the migrated user workflow.

Do not build a generic policy DSL, regenerate the entire dormant schema, or benchmark GraphQL versus HTTP without a measured problem.

## P4 - Private files, cutover, and release

**Status:** pending after P3

**User outcome:** The selected product surface runs entirely on Auth V2 in one supportable deployment.

Build only what the enabled UI requires:

- Private object keys and authorized short-lived upload/download for enabled file features.
- One selected deployment topology with only Next public and a proven protected Next-to-Go channel.
- Production email/Google configuration, secret/key rotation, health/readiness, migration release job, backup/restore, and rollback.
- Remove `@neondatabase/auth`, Neon JWKS verification, legacy `auth_user_id` authorization, `ADMIN_EMAILS`, demo identity/reset routes, browser-visible Go URLs, arbitrary GraphQL forwarding, and durable public file URLs.
- Remove the Auth V2 feature flag after cutover; production must have one authentication path.

Acceptance:

- Full baseline and service-backed suite passes on the release commit and pinned Ubuntu CI.
- Real Google/email smoke passes for dedicated test accounts.
- Transport interception/tamper and public-port checks prove Go/PostgreSQL are not exposed and requests/responses are protected.
- Backup restore, forward migration, compatible rollback, key rotation, and retired-key rejection pass.
- Repository/config/browser/log scans find no reusable credential exposure or legacy authority path.
- A fresh browser can register/sign in and complete every enabled workflow using only Auth V2.

## Explicitly deferred

These are not tasks until a real enabled feature requires them:

- Admin MFA/recovery and Admin bootstrap.
- Professor invitation machinery.
- Generic worker infrastructure beyond a concrete lifecycle event.
- Multi-provider or vendor bake-offs.
- Large synthetic load tests and GraphQL-versus-HTTP benchmarks.
- File/account retention workflows while those features are disabled.
- Authorization work for operations the UI does not expose.