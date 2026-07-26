# Auth v2 status

**Overall state:** `contract_ready`  
**Current phase:** after `G1 Contract-ready`  
**Next task:** `A02 Local/CI/test harness`  
**Security gate approver:** project owner  
**Last updated:** 2026-07-26

## Allowed states

`not_started`, `ready`, `in_progress`, `blocked`, `in_review`, `done`, `superseded`

## Task board

| Task | State | Implementer / reviewer | Dependencies | Branch/PR | Evidence or blocker | Updated |
|---|---|---|---|---|---|---|
| A00 Inventory and containment | done | Codex / project owner | none | `codex/auth-v2-rewrite` | [Inventory, runtime trace, containment, and D-032 disposable-data acceptance](evidence/A00_REPOSITORY_INVENTORY.md) complete | 2026-07-24 |
| A01 Contract approval | done | Codex / project owner | none | `codex/auth-v2-rewrite` | D-018/D-019/D-021/D-027/D-031 accepted; `ViewerBootstrapV1` allowlist recorded; D-024 privileged powers remain closed | 2026-07-24 |
| A02 Local/CI/test harness | in_review | Codex / project owner | A00, A01 | `codex/auth-v2-rewrite` | Harness implementation and local non-container gates pass; mandatory Linux CI database/reset/role/context evidence and owner review remain | 2026-07-26 |
| A03 Auth-provider acceptance spike | not_started | unassigned | A02 | — | Better Auth is first candidate; exact version intentionally unselected; task completes only when one provider passes G3 | 2026-07-24 |
| A04 Schema and identity foundation | not_started | unassigned | A03 | — | — | 2026-07-24 |
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
| G2 Harness-ready | not_started | — | — |
| G3 Framework-accepted | not_started | — | — |
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
