# Auth v2 status

**Overall state:** `identity_foundation`
**Current phase:** `A04` in review
**Next task:** A04 project-owner review
**Security gate approver:** project owner  
**Last updated:** 2026-07-31

## Allowed states

`not_started`, `ready`, `in_progress`, `blocked`, `in_review`, `done`, `superseded`

## Task board

| Task | State | Implementer / reviewer | Dependencies | Branch/PR | Evidence or blocker | Updated |
|---|---|---|---|---|---|---|
| A00 Inventory and containment | done | Codex / project owner | none | `codex/auth-v2-rewrite` | [Inventory, runtime trace, containment, and D-032 disposable-data acceptance](evidence/A00_REPOSITORY_INVENTORY.md) complete | 2026-07-24 |
| A01 Contract approval | done | Codex / project owner | none | `codex/auth-v2-rewrite` | D-018/D-019/D-021/D-027/D-031 accepted; `ViewerBootstrapV1` allowlist recorded; D-024 privileged powers remain closed | 2026-07-24 |
| A02 Local/CI/test harness | done | Codex / project owner | A00, A01 | `codex/auth-v2-rewrite` | Owner approved G2 under D-033 from complete service-backed local and negative-control evidence; exact pinned Ubuntu evidence is deferred only until G3 | 2026-07-26 |
| A03 Auth-provider acceptance spike | done | Codex / project owner | A02 | `codex/auth-v2-rewrite`; draft PR #10 | Owner approved G3 after every `SPIKE-*` row and final pinned Ubuntu run `30670530686` passed | 2026-07-31 |
| A04 Schema and identity foundation | in_review | Codex / project owner | A03 | `codex/auth-v2-rewrite`; draft PR #10 | Canonical schema, isolated roles, idempotent provisioning, SQLc, rollback/forward-fix, dump/restore, and final-tip Ubuntu evidence complete; awaiting reviewer | 2026-07-31 |
| A05 Authenticated Next-to-Go contract | not_started | unassigned | A03, A04 | — | — | 2026-07-24 |
| A06 Google vertical slice | not_started | unassigned | A05 | — | — | 2026-07-24 |
| A07 Email/password and session lifecycle | not_started | unassigned | A06 | — | Production email provider remains open | 2026-07-24 |
| A07M Admin MFA and privileged recovery | not_started | unassigned | A07 | — | Exact accepted factor(s) selected by A03/A07M; required before privileged grants become active | 2026-07-24 |
| A08 Roles, invites, and authorization repair | not_started | unassigned | A07M | — | Exact Professor/Admin matrix blocks completion | 2026-07-24 |
| A09 GraphQL hardening and query shape | not_started | unassigned | A08 | — | — | 2026-07-24 |
| A10 Private files and account cleanup | not_started | unassigned | A08 | — | Retention periods block release, not implementation | 2026-07-24 |
| A11 Operational assurance and cutover | not_started | unassigned | A09, A10 | — | Host, email, backups, and admin bootstrap must be selected | 2026-07-24 |
| A12 GraphQL-versus-HTTP benchmark | not_started | unassigned | A11 | — | Post-auth decision only | 2026-07-24 |

## Phase gates

| Gate | State | Owner approval | Evidence |
|---|---|---|---|
| G0 Contained | done | project owner, 2026-07-24 | A00 evidence; D-032 loss acceptance; legacy deploy jobs removed; no public application or real users |
| G1 Contract-ready | done | project owner delegated safe-default decisions, 2026-07-24 | Accepted public/session/verification/password defaults and `ViewerBootstrapV1`; privileged operations remain unexposed pending D-024/A08 |
| G2 Harness-ready | done | project owner, 2026-07-26 | Complete service-backed local/negative-control evidence; D-033 defers the missing exact pinned Ubuntu run to a hard G3 prerequisite |
| G3 Framework-accepted | done | project owner, 2026-07-31 | [Better Auth 1.6.25 matrix](evidence/A03_BETTER_AUTH_1_6_25.md); final pinned Ubuntu run `30670530686` green |
| G4 Google-complete | not_started | — | — |
| G5 Session-complete | not_started | — | — |
| G5A Privileged-auth complete | not_started | — | — |
| G6 Authorization-complete | not_started | — | — |
| G7 File-complete | not_started | — | — |
| G8 Release-ready | not_started | — | — |
| G9 Transport-decided | not_started | — | — |

## Current repository facts

- No deployment configuration successfully deploys the full system today.
- Legacy conditional Vercel/Fly deployment jobs were removed during A00; CI/build validation remains.
- Current application auth is still the legacy beta Neon integration.
- A root `.dockerignore` and pinned development Compose file now define PostgreSQL 17.10 and Mailpit 1.30.0; production application Dockerfiles remain A11 scope.
- CI/developer toolchain selectors pin Node 22.23.1, npm 11.11.0, and Go 1.25.12 under D-027; this Windows review host itself currently has newer Node 24.18.0, npm 11.16.0, and Go 1.26.5, so the exact baseline still requires the mandatory Linux CI run.
- Canonical product migrations remain `apps/api/migrations/*.sql`; the A02 runner discovers strict ordered versions, stores SHA-256 checksums, serializes with an advisory lock, and applies transactionally with timeouts.
- No application is deployed. Read-only A00 verification found a nonempty Neon database whose 461 aggregate rows the owner classified as disposable demo/test data under D-032; Neon remains untouched until an explicitly approved cutover.
- The owner approved the pre-existing `package-lock.json` diff as the A02 baseline. A02 intentionally adds exact test dependencies and the patched Next 15 release; unrelated normalization remains prohibited.

## Decision-needed queue

| ID | Blocks | Owner | Question | Default if still unresolved at the gate |
|---|---|---|---|---|
| DN-001 | A08/G6 | project owner | Which precise operations may Professor perform versus Admin? | Professor may review/approve projects and manage academic deadlines only; Admin additionally manages roles, accounts, global moderation, and operational configuration. |
| DN-002 | A08/G6 | project owner | Who receives the first Admin grant and through which one-time bootstrap ceremony? | Named owner account, after verified login, granted by an audited one-time CLI using internal user UUID. |
| DN-003 | deployed G4/G8 | project owner | What public hostname will be registered for Google callbacks? | No deployed Google gate until selected. |
| DN-004 | A07/G8 | project owner | Which email provider/relay and sender domain will be used? | Mailpit locally; no public email/password launch. |
| DN-005 | A11/G8 | project owner | What maximum monthly demo budget is acceptable? | Evaluate a small paid PaaS/private-service setup; strict $0 is a time-bounded local demo only. |
| DN-006 | A10/G8 | project owner | What are retention/deletion periods and who owns backups? | Do not accept meaningful real-user files/messages. |

## Evidence format

When a task changes state, append an entry below:

```text
YYYY-MM-DD — TASK-ID — old_state -> new_state — owner
Change: <one sentence>
Tests: <exact commands and concise pass/fail counts>
Evidence: <PR/commit/CI link or repository paths; no secrets>
Notes: <rollback, blocker, or review result>
```

## Append-only change log

2026-07-24 — DOCS — initial living documents created — Codex

Change: Recorded the user's final decisions and converted the dated audit into an implementation control plane.  
Tests: `git diff --check`; PowerShell checks for balanced code fences, valid local Markdown links, unique decision/invariant/test IDs, and matching implementation/status task IDs; focused terminology/security drift scans — all passed. Application suites were not rerun because this change modifies documentation only.  
Evidence: `AGENTS.md`, `docs/auth/*`, `AUTH_ARCHITECTURE_SECURITY_AUDIT.md`.  
Notes: No application code, dependency, migration, or deployment state changed. The pre-existing user-owned `package-lock.json` modification remains untouched.

2026-07-24 — A00 — ready -> in_progress — Codex / project owner

Change: Created `codex/auth-v2-rewrite`, recorded the sanitized repository inventory, and removed ambiguous legacy Vercel/Fly production jobs pending D-023/A11.  
Tests: `npm.cmd run lint` passed with four pre-existing React hook warnings; `npm.cmd run typecheck` passed; `npm.cmd run build` passed; `$env:GOCACHE='D:\quorum\.gocache'; go test ./...` passed. Initial plain `npm`/default-Go-cache attempts were environment-blocked and were rerun through `npm.cmd` and the ignored repository cache.  
Evidence: `docs/auth/evidence/A00_REPOSITORY_INVENTORY.md`, `.github/workflows/ci-cd.yml`, branch `codex/auth-v2-rewrite`.  
Notes: Owner reported that Neon is the only remote service, no Quorum application is deployed, and no real users/meaningful data exist; the existing lockfile diff is now the approved baseline. The sanitized runtime trace confirmed the missing callback exchange and URL-cleanup defect. This entry was superseded by the nonempty-database finding below.

2026-07-24 — A00 — in_progress -> blocked — Codex / project owner

Change: A read-only aggregate Neon inventory disproved the empty-database assumption; no row contents or identifiers were inspected.  
Tests: Temporary read-only transaction counted 24 non-system tables and aggregate test/linkage categories, then the probe file was removed. Result: 461 rows, including 40 product users, 30 auth users, 31 auth accounts, and 48 sessions.  
Evidence: `docs/auth/evidence/A00_REPOSITORY_INVENTORY.md`.  
Notes: No reset/deletion/migration was performed. A00 is blocked until the owner chooses a protected backup location/disposition and exact provider-console checks are completed.

2026-07-24 — A00 — blocked -> done — project owner

Change: Owner classified the inventoried nonempty Neon environment as disposable demo/test data and accepted total loss under D-032; G0 passed without performing deletion.  
Tests: Reused the read-only aggregate inventory and sanitized Google callback trace; `git diff --check` is required after the decision update.  
Evidence: `docs/auth/evidence/A00_REPOSITORY_INVENTORY.md`, D-032, G0.  
Notes: Neon remains untouched. Final cutover must repeat counts, confirm no real users/public deployment, explicitly name the target, invalidate sessions, and receive destructive approval.

2026-07-24 — A01 — in_progress -> done — project owner (delegated safe-default approval)

Change: Accepted the verification, session, anonymous-output, runtime-major, and password defaults; approved sponsor publication review; defined the narrow `ViewerBootstrapV1` response contract.  
Tests: Documentation integrity checks and `git diff --check` passed; no application suite was required for this contract-only task.  
Evidence: D-018, D-019, D-021, D-027, D-031; `docs/auth/AUTH_V2_CONTRACT.md`; `VIEWER-BOOTSTRAP-001`; G1.  
Notes: The project owner's temporary decision delegation was used only for conservative defaults. D-024/DN-001/DN-002 remain open, and every Professor/Admin operation remains unexposed until A08/G6 approval.

2026-07-24 — A02 — ready -> in_progress — Codex / project owner

Change: Began the deterministic local/CI/test harness after A00 and A01 reached done.  
Tests: Failing-first harness and migration safety tests are required before implementation.  
Evidence: branch `codex/auth-v2-rewrite`; A02 task card.  
Notes: The existing user-owned `package-lock.json` diff remains the approved baseline and will not be normalized incidentally.

2026-07-26 — A02 — implementation checkpoint — Codex / project owner

Change: Added pinned PostgreSQL/Mailpit Compose dependencies, hardened canonical migrations, guarded local initialization/reset, least-privilege role bootstrap, mandatory CI database/Mailpit paths, Vitest/Testing Library, Playwright Chromium, Docker-context sentinels, and checksum-pinned Gitleaks history scanning. Upgraded Next within major 15 to the patched 15.5.21 release.
Tests: `$env:GOCACHE='D:\quorum\.gocache'; go test ./...` passed; `go vet ./...` passed; `npm.cmd run test:web` passed 2 tests; `npm.cmd run test:e2e` passed 1 Chromium test; `npm.cmd run typecheck` passed; `npm.cmd run build` passed with four pre-existing hook warnings; `docker compose -f compose.dev.yml config --quiet` passed; pinned Gitleaks 8.30.1 scanned 47 commits with three reviewed inert false positives fingerprint-allowlisted and then reported no leaks.
Evidence: `.dockerignore`, `compose.dev.yml`, `.github/workflows/ci-cd.yml`, `apps/api/internal/{migrate,localdb,dbroles}`, `apps/api/cmd/{migrate,localdb,bootstrap-roles}`, `apps/web/vitest.config.ts`, `playwright.config.ts`, `scripts/verify-docker-context.mjs`, `.gitleaksignore`.
Notes: Local Linux containers cannot start because this Windows host lacks WSL; repository work continues and CI is configured to fail hard unless real PostgreSQL, reset/replay, role, Mailpit, Docker-context, unit, and browser checks pass. Production audit still reports vulnerabilities inherited through the legacy Neon auth wrapper and Next 15 transitive build dependencies; no unsafe forced audit rewrite was applied.

2026-07-26 — A02 — in_progress -> in_review — Codex / project owner

Change: Completed the A02 repository implementation and moved it to review without claiming G2.
Tests: Clean `npm.cmd ci` passed after stopping only Quorum processes; required Go integration suites failed as designed when their database variables were removed; full Go unit/vet, web unit/component, typecheck, production build, and self-terminating Chromium smoke gates passed.
Evidence: A02 implementation checkpoint above and the milestone commit on `codex/auth-v2-rewrite`.
Notes: The project owner must review and pass G2 only after the mandatory Linux CI service-backed jobs are green. Legacy checksum-less migration ledgers fail closed and require an explicit repair decision; disposable local databases use the guarded reset, and the planned clean auth-v2 database needs no repair.

2026-07-26 — A02 — in_review review checkpoint — Codex / project owner

Change: Re-reviewed commits `e21d1e5` and `0b6d58d` plus the clean worktree; retained A02 in review and G2 unpassed because no Linux service-backed CI run or complete per-harness negative-control evidence is available.
Tests: `$env:GOCACHE='D:\quorum\.gocache'; go test ./...` and `go vet ./...` passed; `npm.cmd run test:web` passed 2 tests; sequential `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, and `npm.cmd run test:e2e` passed (four pre-existing hook warnings; 1 Chromium test); `docker compose -f compose.dev.yml config --quiet` passed; `QUORUM_REQUIRE_INTEGRATION=true` with all integration database URLs absent failed for the intended missing-database reasons. `npm.cmd run test:docker-context` could not run because the Docker daemon is unavailable; starting `com.docker.service` was denied by the host.
Evidence: branch `codex/auth-v2-rewrite`; commits `e21d1e5` and `0b6d58d`; A02 task card and G2 gate.
Notes: An initial parallel web verification raced on the shared `.next` directory; the affected typecheck and Playwright commands were rerun sequentially and passed. A03 remains dependency-blocked until A02 is `done`; no provider dependency, schema, route, or product behavior was changed.

2026-07-26 — A02 — in_review correction checkpoint — Codex / project owner

Change: Corrected Docker Desktop host-port suppression caused by the internal-only Compose network, made the Docker-context launcher shell-free on Windows, repaired two database-backed test harness defects exposed by real PostgreSQL, and pinned the supported Node 22.23.1/Go 1.25.12 patch toolchains.
Tests: Fresh `docker compose -f compose.dev.yml up -d --wait` created healthy pinned PostgreSQL 17.10 and Mailpit 1.30.0 services with loopback-only host ports; canonical migrate, local identity init, guarded reset/replay, and role bootstrap twice passed. With the documented local-only test URLs and `QUORUM_REQUIRE_INTEGRATION=true`, `go test -count=1 ./...` and `go vet ./...` passed, including migration, role, and GraphQL integration suites. `npm.cmd run test:web`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test:e2e`, `npm.cmd run test:docker-context`, Mailpit `/readyz`, and `git diff --check` passed (2 Vitest tests, 1 Chromium test, four pre-existing hook warnings). Temporary negative controls made Go unit, Vitest, Playwright, required integration with missing/stopped PostgreSQL, stopped-Mailpit readiness, and weakened `.dockerignore` sentinel checks fail for their intended reasons; every mutation was reverted and the clean suites reran green.
Evidence: `compose.dev.yml`, `.nvmrc`, `.github/workflows/ci-cd.yml`, `apps/api/go.mod`, `apps/api/internal/{graph,migrate}`, `scripts/verify-docker-context.mjs`, and the A02/G2 verification rows.
Notes: A02 remains `in_review` and G2 remains unpassed. This local branch has no upstream/PR, so the mandatory Ubuntu CI service-backed job has not run; only the project owner may approve G2. A03 remains dependency-blocked and no provider code was started.

2026-07-26 — A02 — in_review least-privilege correction — Codex / project owner

Change: Hardened idempotent role bootstrap so existing Quorum owner/runtime roles are repaired to `NOBYPASSRLS`, and direct `CREATE ON SCHEMA public` is removed from auth/app runtime roles rather than only from `PUBLIC`.
Tests: Failing first, `$env:QUORUM_REQUIRE_INTEGRATION='true'; go test -count=1 -run TestIntegrationBootstrapIsIdempotentAndLeastPrivilege ./internal/dbroles` failed once because a deliberately contaminated `quorum_app_runtime` retained `BYPASSRLS`, then failed again because it retained a direct public-schema `CREATE` grant. After the repair, the focused command passed. With the documented local-only database variables, `go test -count=1 ./...` passed all Go packages including migration, role, and GraphQL integration; `go vet ./...`, `npm.cmd run test:web` (2 tests), `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test:e2e` (1 Chromium test), `npm.cmd run test:docker-context`, and `git diff --check` passed. Lint/build retained four pre-existing React hook warnings.
Evidence: `apps/api/internal/dbroles/bootstrap.go`, `apps/api/internal/dbroles/integration_test.go`; branch `codex/auth-v2-rewrite`.
Notes: The contamination is test-only and is repaired/cleaned even on failure. A02 remains `in_review`, G2 remains unpassed, and A03 remains dependency-blocked pending the mandatory Ubuntu run and explicit project-owner approval.

2026-07-26 — A02 — in_review runtime-membership correction — Codex / project owner

Change: Extended idempotent role repair to revoke every parent-role membership from auth/app runtime roles, closing the `SET ROLE` path that `NOINHERIT` alone does not prevent; migrator memberships remain untouched for later schema-owner grants.
Tests: Failing first, `$env:QUORUM_REQUIRE_INTEGRATION='true'; go test -count=1 -run TestIntegrationBootstrapIsIdempotentAndLeastPrivilege ./internal/dbroles` failed because a deliberately contaminated `quorum_app_runtime` remained a member of `quorum_app_owner`. After the repair, the focused command passed. With documented local-only integration variables, `go test -count=1 ./...`, `go vet ./...`, and `git diff --check` passed.
Evidence: `apps/api/internal/dbroles/bootstrap.go`, `apps/api/internal/dbroles/integration_test.go`; branch `codex/auth-v2-rewrite`.
Notes: The test cleanup revokes its synthetic membership even on failure. A02 remains `in_review`, G2 remains unpassed, and A03 remains dependency-blocked.

2026-07-26 — A02/G2 — in_review -> done — project owner

Change: The project owner explicitly approved G2 and authorized continuation; D-033 records the sequencing exception because GitHub MCP confirms no PR-triggered Ubuntu run exists.
Tests: Reused the complete pinned Docker/PostgreSQL/Mailpit, migration/reset/role, Go integration/vet, Vitest, lint/typecheck/build, Playwright, Docker-context, and per-harness negative-control evidence recorded above.
Evidence: D-033; commits `0b6d58d`, `b323153`, `b3c0988`, and `0dc4302`; branch `codex/auth-v2-rewrite`.
Notes: The exact pinned Ubuntu workflow was deferred, not waived. It is a hard G3 prerequisite; A03 cannot complete and A04/A05 cannot start until it is green.

2026-07-26 — A03 — not_started -> in_progress — Codex / project owner

Change: Began the exact-version auth-provider acceptance spike after A02/G2 owner approval under D-033.
Tests: A failing acceptance contract test is required before candidate installation or spike implementation.
Evidence: branch `codex/auth-v2-rewrite`; A03 task card and every `SPIKE-*` verification row.
Notes: Development/test-only feature flag required; no product roles/workflows, production exposure, second migration history, A04, or A05 work is in scope.

2026-07-26 — A03 — Better Auth candidate rejected — Codex / project owner

Change: Rejected exact stable `better-auth@1.6.25` and removed its spike route, provider configuration, generated schema, manifest dependencies, and focused lockfile changes under A03's `REJECT` rollback rule. A03 remains `in_progress`; G3, A04, and A05 remain blocked pending a different maintained provider that passes every `SPIKE-*` row.
Tests: Failing first, the service-backed password-policy negative control submitted 13 ASCII code points plus one supplementary Unicode code point (14 code points, 15 JavaScript UTF-16 code units) with `minPasswordLength: 15`. `npm.cmd run test:auth-provider-spike --workspace=@quorum/web` failed exactly because signup returned HTTP 200 instead of 400 and persisted the account; test cleanup removed the synthetic account/message and the other 8 PostgreSQL/Mailpit/schema/route/session checks passed. The candidate implementation uses JavaScript string length at the password boundary and offers no configuration for code-point counting; adding Quorum plaintext validation would violate D-031/PASS-02.
Evidence: R-007; rejected candidate commit `0394097`; the final isolated run reported 1 intended failure and 8 passes. Before rejection, live checks also established six schema-isolated tables owned by `quorum_auth_owner`, least-privilege `quorum_auth_runtime` operation, `quorum_app_runtime` denial, credential password hashing, Mailpit verification delivery, wrong-origin rejection, secure host-only cookie attributes, projected session JSON, immediate revocation, raw sign-in JSON containing the reusable session token, and the database storing that same directly reusable token. No credential values were recorded.
Notes: No security rule or test was weakened. The Better Auth artifacts and dependencies are removed rather than leaving an intentionally failing suite or a production-visible spike. The exact pinned Ubuntu workflow remains a hard prerequisite for eventual G3 acceptance under D-033.

2026-07-26 — A03 — in_progress -> blocked — Codex / project owner

Change: Tested and rejected the second maintained provider candidate, exact stable Ory Kratos 26.2.0, then removed its image-backed spike configuration and in-memory identities. Opened D-034 because both candidates fail the same accepted password unit and the next common self-hosted option, SuperTokens, documents backend custom password validators—the plaintext handling D-031/PASS-02 prohibit.
Tests: The pinned immutable image `oryd/kratos:v26.2.0@sha256:2a13bb8d362c7a7ae33bd7c0f5168aee46921f15c916a06346db91c06dc76643` was configured with `min_password_length: 15`. The automated API-flow test failed because 14 Unicode code points containing one supplementary character returned HTTP 200. A separate non-development-mode run produced the sanitized controls: 14 ASCII code points -> HTTP 400; 14 code points with one supplementary character -> HTTP 200; 15 code points -> HTTP 200. No password value or identity data was logged, and the loopback-only container/in-memory store was removed.
Evidence: R-008, D-034, Ory Kratos 26.2.0 release/image digest and Apache-2.0 license. SuperTokens' maintained documentation states that replacing its default password rule requires a backend `validate` function, so it was not installed as a third candidate under the current no-custom-credential-handling rule.
Notes: A03 and G3 are blocked—not passed or in review. A04/A05 remain unstarted. The owner must resolve D-034; the Ubuntu workflow remains independently required before any eventual G3 acceptance.

2026-07-27 - A03/D-034 - blocked -> in_progress - project owner / Codex

Change: The owner delegated D-034 to Codex. The accepted conservative decision retains the 15-Unicode-code-point floor without Quorum plaintext validation and permits provider-native encoded thresholds only at 29 UTF-16 code units or 57 UTF-8 bytes, which exclude every 14-code-point input while accepting at least 64 ASCII characters.
Tests: Added deterministic unit-specific boundary probes for 14 and 15 maximum-width Unicode code points, 15 ASCII characters, the required 64-character support floor, the 128 target, and the over-target boundary. `npm.cmd run test:auth-spike --workspace=@quorum/web` passed 136 tests in 14 files; `npm.cmd test --workspace=@quorum/web -- --run` passed 138 tests in 15 files; `npm.cmd run typecheck --workspace=@quorum/web` passed; and `git diff --check` passed with only line-ending notices.
Evidence: D-034; PASS-02; SPIKE-PASSWORD-001; `apps/web/lib/auth-v2/spike/password-policy-probe.ts`.
Notes: This resolves only the password-unit policy blocker and reopens A03. It does not accept a provider or pass G3. R-007/R-008 remain historical candidate results; the pinned Ubuntu workflow and every `SPIKE-*` row remain required. A04/A05 remain unstarted.

2026-07-27 - A03 - exact Better Auth retest checkpoint - Codex / project owner

Change: Reintroduced exact current stable `better-auth@1.6.25` as a development-only candidate under D-034, upgraded exact support fixtures to current `oidc-provider@9.11.1`, `openid-client@6.8.4`, `pg@8.22.0`, and `@types/pg@8.20.0`, and added isolated provider-backed acceptance tests. No production route imports or mounts the candidate.
Tests: Failing first, the candidate configuration module was absent; the new configuration test then passed. Pinned PostgreSQL service tests passed 8 tests in 4 files for D-034 password boundaries, hashed credentials, email hooks, wrong-origin rejection, isolated `better_auth` schema/ownership/runtime grants, signed-cookie-only session reuse, two-instance database rate limiting, and fail-closed store outage. `npm.cmd run test:auth-spike --workspace=@quorum/web` passed 137 tests in 15 files; web typecheck and `git diff --check` passed. Web lint and production build passed earlier in the same checkpoint with four pre-existing React hook warnings and no auth-spike route in the route inventory.
Evidence: `apps/web/lib/auth-v2/spike/better-auth-*`, `apps/web/vitest.auth-provider.final.config.ts`, exact manifest and lockfile entries. The registry reported Better Auth 1.6.25 as current stable/MIT; install reported the unchanged repository-wide summary of 3 moderate, 5 high, and 1 critical findings. No secret, token, cookie, password, email content, or database value is recorded.
Notes: The database session token equals the provider's internal sign-in JSON token, but live negative controls proved it is not accepted as a raw cookie or bearer credential; only the separately HMAC-signed host-only Secure HttpOnly cookie authenticated. The BFF projection must still suppress the internal token field. A03/G3 remain in progress: the remaining provider-backed lifecycle/link/MFA/sync/performance rows, deterministic upgrade fixture, and pinned Ubuntu job are not claimed. A04/A05 remain unstarted.
2026-07-31 - A03 - exact Better Auth OAuth/provider milestone - Codex / project owner

Change: Added exact `better-auth@1.6.25` generic OAuth authorization/callback acceptance against the pinned loopback OIDC provider, plus provider-backed lifecycle, Mailpit, MFA, rate-limit, linking-policy, reconciliation, upgrade, performance, and session-context coverage. The spike remains development/test-only and no production route mounts it.
Tests: Failing first, the exact OAuth test exposed a schema-assertion column mismatch; after correcting the assertion to the canonical quoted provider column, the focused test passed. With the sanitized local Docker operator URL supplied only to the process, `npm.cmd run test:auth-provider-spike --workspace=@quorum/web` passed 19 tests in 13 files; `npm.cmd run test:auth-spike --workspace=@quorum/web` passed 144 tests in 19 files; web typecheck and `git diff --check` passed. The exact flow proved state plus S256 PKCE generation, exact callback, persisted account/session, modified-state denial, and code-replay denial without recording protocol or credential values.
Evidence: `docs/auth/evidence/A03_BETTER_AUTH_1_6_25.md`; `apps/web/lib/auth-v2/spike/better-auth-oauth.integration.test.ts`; commit `a140d7b` for the preceding provider milestone.
Notes: The consolidated local gates also passed: full web Vitest (146 tests in 20 files), lint (four pre-existing hook warnings), typecheck, Next 15.5.21 production build with no auth-v2 spike route, one Chromium Playwright test, Docker-context verification, required PostgreSQL-backed Go migration/role/GraphQL/auth/localdb/storage tests, Go vet, and patch integrity. A03/G3 remain in progress only for publication plus the D-033 pinned Ubuntu workflow and formal acceptance updates. A04/A05 remain unstarted.
2026-07-31 - A03 - in_progress -> in_review - Codex / project owner

Change: Accepted exact `better-auth@1.6.25` as the proposed D-008 framework configuration after every `SPIKE-*` row passed; opened draft PR #10 and retained the provider only behind the development/test spike boundary. No product role, domain workflow, production route, second migration history, A04, or A05 work was added.
Tests: GitHub Actions run `30670240145`, job `91286223141` (`Verify`), passed in 3m03s on the pinned Ubuntu workflow. It passed repository-history secret scanning, clean dependency installation, Docker-context verification, lint, typecheck, production build, API unit tests, canonical migrations, guarded local identity/reset/replay, idempotent role bootstrap, required database integrations, the exact auth-provider spike, web Vitest, Chromium Playwright, and Mailpit readiness. The preceding consolidated local evidence also remains green.
Evidence: draft PR `mannrp/quorum#10`; `docs/auth/evidence/A03_BETTER_AUTH_1_6_25.md`; commits `a140d7b` and `bac81a5`.
Notes: A03 and G3 are `in_review`, not done. Only the project owner may pass G3. A04/A05 remain unstarted until that explicit approval.

2026-07-31 - A03/G3 - in_review -> done - project owner

Change: The project owner explicitly approved G3 after reviewing the complete exact `better-auth@1.6.25` acceptance evidence and green pinned Ubuntu workflow.
Tests: Final PR-tip GitHub Actions run `30670530686`, job `91287105971` (`Verify`), passed in 2m54s with every mandatory service-backed step green.
Evidence: project-owner statement "I approve G3"; draft PR `mannrp/quorum#10`; `docs/auth/evidence/A03_BETTER_AUTH_1_6_25.md`; commit `f7018cd`.
Notes: A03 and G3 are done. This accepts only the reviewed framework/configuration boundary; provider upgrades reopen D-008/A03 evidence requirements.

2026-07-31 - A04 - not_started -> in_progress - Codex / project owner

Change: Began the additive canonical schema and identity foundation after A03/G3 completion, with Codex as implementer and the project owner as reviewer on `codex/auth-v2-rewrite`.
Tests: A failing A04 migration/provisioning test is required before schema or domain implementation.
Evidence: A04 task card; ID-01 through ID-08, SYNC-01/SYNC-02, DATA-01 through DATA-03, SES-04, and MIG-01.
Notes: A05 remains unstarted. A04 does not mount production authentication, alter product roles/workflows, drop legacy columns, or move every legacy table from `public`.

2026-07-31 - A04 - in_progress -> in_review - Codex / project owner

Change: Added canonical migration `000008` for the accepted Better Auth 1.6.25 schema plus additive product identity, lifecycle, grants, invitation, inbox/outbox, reconciliation, and audit foundations. Added idempotent transactional provisioning; NOLOGIN owners and audit reader; scoped migrator/auth/app privileges; conditional Supabase Data API revocations; guarded-reset ACL restoration; pinned SQLc generation and drift enforcement; and a disposable provider-spike database.
Tests: Failing-first PostgreSQL tests exposed the absent A04 catalogs, public cross-reference grants, reconciliation column, integration-owner usage, provisioning API, ambiguous JSON SQL parameters, migrator owner membership/database/public CREATE, guarded-reset ACL loss, product-runtime public access, and missing audit-reader boundary. The corrected required command with local-only service variables, `go test -count=1 ./...`, passed every Go package including empty/N-1/concurrent/checksum/timeout/reset replay, role isolation/default privileges, concurrent idempotent provisioning/collisions/multiple provider methods, rollback/forward-fix, and real `pg_dump`/`pg_restore`. `npm run db:generate`, lint, typecheck, Next build, Docker-context verification, exact provider spike (19 tests/13 files), web Vitest (146 tests/20 files), Chromium Playwright (1 test), and Mailpit HTTP readiness passed. Final-tip GitHub Actions run `30673150362`, job `91294902948` (`Verify`), passed in 4m11s with every required step green.
Evidence: commits `6f50e1e`, `6b38a43`, `561de84`, and `f045924`; draft PR `mannrp/quorum#10`; `apps/api/migrations/000008_auth_v2_identity_foundation.sql`; `apps/api/internal/{identity,migrate,dbroles}`; `apps/api/queries/identity.sql`; `scripts/run-auth-provider-spike.mjs`; workflow run `30673150362`.
Notes: Failed Ubuntu runs were retained as negative evidence: run `30671968028` exposed reset replay losing public-schema ACLs, and run `30672908771` exposed the provider spike colliding with the now-canonical `better_auth` schema. Both were fixed without weakening tests. A04 is in review, not done; the project owner remains the reviewer. A05 has not started.
