# Auth V2 status

**State:** implementation complete; P4 release-host/provider validation remains
**Active work:** release-host and real-provider evidence only
**Branch:** `codex/auth-v2-rewrite`
**Pull request:** `mannrp/quorum#10` (draft)
**Updated:** 2026-08-02

## Working product

Quorum has one browser authentication path: Better Auth `1.6.25` mounted by public Next at `/api/auth/[...path]`.

- Email/password registration, verification, sign-in, reset, change, and explicit Google linking use opaque host-only HttpOnly sessions. Verification and reset links are one-use.
- Google uses one exact callback. Implicit same-email linking is disabled. The deterministic OIDC provider is development/test-only and production rejects it.
- Verified users self-enroll only as Student or Sponsor. Go receives a 15-second Next assertion, resolves current PostgreSQL identity/account/role state, and fails closed for inactive or unknown principals.
- Canonical Student/Sponsor grants gate product entry points. Team membership, project ownership, workflow state, and private nested fields are authorized from current database state.
- Public discovery and every enabled authenticated workflow use typed registered operations. Browser-supplied GraphQL, backend URLs, authority fields, file URLs, and reusable credentials are not accepted or projected.
- Teams, projects, applications/offers, dashboard, direct messaging, notifications, profile completion, account methods, session management, and deactivation are wired through the Auth V2 path.
- Deactivation updates both the product profile and canonical account state in one transaction, increments session revocation state, revokes browser sessions, and signs the user out.
- Production images run non-root Next and Go containers. Only Next binds loopback ingress; Next reaches Go through a restrictive Unix socket. A one-shot migrator runs canonical migrations before the API, and each service receives a separate environment file.
- Admin and files remain intentionally disabled. Their old public/legacy paths are absent rather than hidden behind runtime compatibility code.

## Phase board

| Phase | Status | Result |
|---|---|---|
| C0 Cleanup | done | Lean contract, status, plan, and operations sources of truth |
| P1 Authentication and viewer | done | Better Auth cutover and current-state viewer |
| P2 Account lifecycle | done | Google, recovery, linking, credential changes, and sessions |
| P3 Product operations | done | Enabled workflows use registered operations and Go authorization |
| P4 Release | in review | Code and pinned Ubuntu CI green; release-host/provider evidence remains |

## Latest verified evidence

Verified locally on 2026-08-02:

```text
npm run lint                                                     PASS
npm run typecheck --workspace=@quorum/web                        PASS
npm run build                                                    PASS
npm run test:web                                                 PASS (16 files, 114 tests)
npm run test:docker-context                                      PASS
cd apps/api && go test ./internal/auth ./internal/server ./internal/graph
                                                                 PASS
service-backed cd apps/api && go test -count=1 ./...             PASS (PostgreSQL required; no skips)
npm run test:e2e                                                PASS (handler 10 + Chromium 5; no skips)
production API and web Docker builds                            PASS
production Next HTTP and read-only Unix-socket runtime probes    PASS
pinned Ubuntu Verify workflow                                  PASS (2m37s)
```

The service-backed run used pinned PostgreSQL `17.10-alpine3.24` and Mailpit `1.30.0` on loopback-only ports. The production-image probes confirmed non-root execution, direct Next PID 1, migrator binary and canonical migrations in the API image, stale-socket restart handling, and a read-only socket mount in web.

## Remaining release evidence

No further Auth V2 architecture or product implementation phase is planned. Before merge/release:

1. On the release host, supply the three separate secret files and verify PostgreSQL private/TLS access, backup/restore, compatible rollback, graceful shutdown, socket ownership/mode, and assertion-key overlap/retirement.
2. Run real Google and transactional-email smoke tests with production origins and callbacks.
3. Track the three high transitive findings reported by `npm audit --omit=dev` on 2026-08-02. They are Next `16.2.12` dependencies (`postcss@8.4.31` and `sharp@0.34.5`); `16.2.12` is the current npm release and npm offers only a forced downgrade to Next `9.3.3`, so no safe package update is currently available.

These are deployment/provider checks, not blockers to local product use. Admin remains unavailable until separate MFA/recovery work, and private files remain unavailable until a separately accepted file feature.
