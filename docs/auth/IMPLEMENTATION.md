# Auth V2 implementation and finish plan

This is the only Auth V2 delivery plan. `STATUS.md` states current reality, `AUTH_V2_CONTRACT.md` contains durable security rules, and git/CI hold implementation history. Do not create another roadmap, gate matrix, benchmark plan, or evidence archive.

## Definition of finished

Auth V2 is finished when a fresh browser can register or sign in with email/password or Google, enroll as Student or Sponsor, use every enabled Quorum workflow, manage its profile, credentials, and sessions, and sign out without any legacy identity path.

Admin and file-management features are disabled and are not Auth V2 completion blockers. Their old authority, upload, and public-URL paths must remain unreachable.

The release must have:

- one Better Auth configuration and browser client;
- one opaque host-only session cookie;
- one short-lived Next-to-Go assertion path;
- current-state Go principal and authorization checks;
- registered browser operations only, with no browser-supplied GraphQL;
- only Next exposed publicly and a protected production Next-to-Go transport;
- no Neon Auth, legacy bearer verifier, `ADMIN_EMAILS`, demo identity, public file URL, or browser-visible Go endpoint;
- green local, service-backed, browser, build, and pinned Ubuntu checks.

## Delivery rules

- P4 is the only active phase. Finish one working release path rather than starting another framework.
- Start behavior changes with a focused failing test, then run the smallest relevant checks while iterating.
- Prefer explicit route modules and small functions. Add an interface only at a real external boundary.
- Reuse correct Go domain/resolver logic; do not rewrite the product alongside authentication.
- Internal GraphQL may remain private, but the browser sends only registered operation IDs and typed variables.
- Keep security negative controls. Remove compatibility shims, dead helpers, and stale documentation instead of preserving them ceremonially.
- Commit substantial green milestones. Update `STATUS.md` when release truth changes, not after every command.

## Phase summary

| Phase | Status | Product result |
|---|---|---|
| C0 Cleanup | done | Lean contract, status, plan, and operations sources of truth |
| P1 Authentication cutover and viewer | done | Better Auth replaced Neon and verified users reach the product through the signed Next-to-Go boundary |
| P2 Google and account lifecycle | done | Google/password sign-in, recovery, linking, email/password changes, and session management |
| P3 Product operation migration | done | Enabled UI workflows use registered operations and current-state Go authorization |
| P4 Release | in progress | Production-shaped deployment, final cleanup, and release evidence |

## Completed implementation

### P1 - Authentication cutover and viewer

- Better Auth `1.6.25` owns email/password authentication, verification mail, opaque database sessions, and host-only HttpOnly cookies.
- Verified users self-enroll only as Student or Sponsor. Next derives session identity, signs a 15-second Ed25519 assertion, and private Go resolves current PostgreSQL state into `ViewerBootstrapV1`.
- Legacy Neon modules, JWKS/bearer verification, `ADMIN_EMAILS`, demo persona/reset paths, and browser backend configuration are removed.

### P2 - Google and account lifecycle

- Google uses one exact callback and explicit account linking; implicit same-email merging is disabled.
- Password reset/change, two-mailbox email change, session listing/revocation, logout-all, idle/absolute expiry, and cross-tab invalidation are implemented.
- The deterministic OIDC provider remains a development/test harness only. It is rejected by production server configuration.

### P3 - Registered product operations

- Home, profiles, teams, projects, dashboard, inbox, notifications, and account/profile settings use typed registered operations.
- Next validates same-origin JSON and maps operation IDs to reviewed private documents. Go authorizes current users, relationships, resource state, and nested private fields.
- Browser GraphQL text, its client/query modules, and `/api/graphql` are deleted. Go GraphQL remains private to avoid an unrelated product rewrite.

## P4 - Release

### P4.1 Disabled files

**Status:** done

No enabled UI uploads or serves files. The dormant signer, public URL API, and production object-storage requirement are removed. Historical database columns remain inert; do not edit applied migrations or add a migration solely to delete them.

A later file feature is separate product work. It must store object keys, authorize every operation in Go, and issue short-lived scoped upload/download grants from private storage.

### P4.2 Production topology

The repository uses the first supported production shape: separate non-root Next and Go containers on one host, a restrictive shared Unix-domain socket for Next-to-Go traffic, PostgreSQL on its private/TLS path, and only loopback Next ingress for an external HTTPS proxy. Production rejects a plain HTTP Next-to-Go fallback.

Implemented in the repository:

- web, API, and migrator use separate environment files;
- canonical migrations run as a serialized one-shot service before the API;
- both images run non-root, Next is direct PID 1, web mounts the shared socket read-only, and API handles restrictive permissions and stale sockets;
- only loopback Next ingress is published by the production Compose shape.

Remaining work is release-host validation: health and graceful shutdown, PostgreSQL TLS/private access, backup/restore, compatible rollback, assertion-key rotation, credential-safe logs, and real Google/transactional-email smoke tests. Do not add another deployment or provider framework.

If the release host cannot support the one-host socket, replace only that transport with mTLS and record the concrete reason in `STATUS.md`.

### P4.3 Final cleanup and release evidence

Repository-owned cleanup is complete. The remaining items below are release verification, not another implementation phase.

Delete or prove absent:

- Neon packages, modules, environment variables, JWKS verification, and legacy `auth_user_id` authority;
- `ADMIN_EMAILS`, demo identity/reset routes, browser backend URLs, `/api/graphql`, and browser GraphQL text;
- public Go/database ports, public file URLs, and reusable credentials in responses, logs, URLs, or browser storage;
- production feature flags or dual-auth branches; the deterministic OIDC harness may remain only behind its nonproduction guard;
- unused runtime helpers, types, dependencies, and stale setup/auth documentation.

Release verification:

- run the repository baseline commands from `AGENTS.md` and the required PostgreSQL/Mailpit flow from `OPERATIONS.md`;
- verify clean install, production images/context, canonical migrations, backup/restore/rollback, assertion rotation, and transport plaintext/tamper rejection;
- run real Google and transactional-email smoke tests;
- review `npm audit --omit=dev` and resolve applicable high/critical findings in enabled runtime code without forced downgrades;
- pass pinned Ubuntu CI on the exact release commit;
- complete every enabled workflow in a fresh browser using Auth V2 only.

When these checks pass, update `STATUS.md` to `complete`, make the pull request ready, and merge. There is no additional gate or benchmark phase.

## Deliberately out of scope

These require separate product requests:

- re-enabling Admin, which first requires MFA, recovery, and bootstrap policy;
- file upload/download and storage-vendor integration;
- Professor invitation machinery not used by the enabled UI;
- providers beyond Google and email/password;
- generic workflow/worker or policy platforms;
- GraphQL-versus-HTTP benchmarks without a measured production problem;
- authorization or retention workflows for disabled features.
