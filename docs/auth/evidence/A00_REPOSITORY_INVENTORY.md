# A00 repository inventory and owner attestation

**Task:** `A00 Inventory and containment`  
**Branch:** `codex/auth-v2-rewrite`  
**Captured:** 2026-07-24  
**State:** complete; owner classified the inventoried Neon dataset as disposable demo/test data and accepted loss  

This record contains identifiers and counts only where they are safe and repository-verifiable. It deliberately contains no connection strings, credentials, tokens, cookies, OAuth codes, private object names, or personal data.

## 1. Repository-derived asset inventory

| Asset type | Environment | Redacted identifier | Owner | Console checked | User/data count | Public? | Backup/evidence | Disposition |
|---|---|---|---|---|---|---|---|---|
| Git repository | development/CI | GitHub `mannrp/quorum` | project owner | declaration received; settings check pending | source only | no deployed application reported | Git history; local branch | Keep; inspect repository deployments/environments/secrets |
| Web application | local | `apps/web`, Next.js | project owner | owner declared 2026-07-24 | no real users/data | not deployed | source inventory | Target sole public product origin |
| Domain API | local | `apps/api`, Go/gqlgen | project owner | owner declared 2026-07-24 | no real users/data | not deployed | source inventory | Target private service |
| Product database | local plus remote Neon | `DATABASE_URL` in ignored local API env | project owner | read-only aggregate inventory completed 2026-07-24 | 40 product users; 461 total rows across 24 tables | no public application access | exact aggregate counts below; no row contents inspected | Owner-declared disposable demo/test data; preserve untouched until explicit cutover |
| Legacy identity provider | remote Neon | Neon Auth base/issuer/JWKS variables | project owner | read-only aggregate inventory completed 2026-07-24 | 30 auth users, 31 accounts, 48 sessions | provider endpoint exists; no deployed Quorum app | exact aggregate counts below; no identities inspected | Owner-declared disposable; invalidate/delete only at explicit cutover |
| Google OAuth | legacy Neon-mediated development flow | initiated through Neon social sign-in | project owner | sanitized runtime trace complete 2026-07-24 | nonempty test/auth state; ownership unresolved | callback endpoint exists only for development flow | verifier presence and visible failure recorded without values | Register new client/origins for selected deployment; do not reuse legacy state blindly |
| Object storage | local configuration only | Cloudflare R2-shaped variables | project owner | owner attested no other remote assets 2026-07-24 | no meaningful objects | no deployed access path | source/env-key inventory plus owner attestation | Create/verify private bucket only when required |
| CI | GitHub Actions | `.github/workflows/ci-cd.yml` | project owner | pending | n/a | workflow metadata | source inventory | CI retained; success-by-skip smoke is an A02 defect |
| Legacy web deployment | GitHub Actions/Vercel | conditional Vercel production job | project owner | pending | unknown deployment | unknown | removed from branch during A00 | Remain disabled until D-023/A11 |
| Legacy API deployment | GitHub Actions/Fly | conditional Fly job; no `apps/api/fly.toml` | project owner | pending | no repo-deployable artifact | unknown | removed from branch during A00 | Remain disabled until D-023/A11 |
| Email delivery | local/unknown | no application SMTP provider configured; legacy Neon owns auth mail | project owner | pending | unknown | n/a | repository inventory | Mailpit at A02; production provider remains D-025 |
| DNS/TLS/tunnel/university host | none | no repository-owned configuration found | project owner | owner attested 2026-07-24 | n/a | none | repository inventory plus owner attestation | Select during D-023/A11 |

## 2. Current repository surfaces

### Browser and Next routes

- Browser auth mounts `apps/web/app/api/auth/[...path]/route.ts`.
- Browser GraphQL uses `apps/web/app/api/graphql/route.ts`, which forwards to `API_URL`, browser-visible `NEXT_PUBLIC_API_URL`, or local Go by fallback.
- Demo persona and reset routes exist at `/api/demo/persona` and `/api/demo/reset`; their visible/configured flags are `NEXT_PUBLIC_ENABLE_DEMO_MODE` and `NEXT_PUBLIC_DEMO_RESET_ENABLED`.
- The current OAuth completion page is `/auth/complete`.
- Ignored local files `apps/web/.env`, `apps/web/.env.local`, and `apps/api/.env` exist. Git does not track them. Their key names were inventoried without reading values into this record.

### Go HTTP routes

- `/graphql` — GraphQL endpoint.
- `/healthz` — combined health endpoint.
- `/demo/reset` — demo reset endpoint; configuration-gated.
- `/` — GraphQL playground outside production according to server configuration; deployed behavior still needs runtime confirmation.

### Database and migrations

- `apps/api/migrations` contains seven migrations, `000001` through `000007`, and remains the canonical history.
- The current migrator uses generic `DATABASE_URL`, creates unqualified `schema_migrations`, discovers `migrations/*.sql` by glob, and records filenames only.
- It has transactions per migration, but no dedicated migrator credential, advisory lock, checksum, missing/empty-manifest failure, or explicit lock/statement timeout. A02 owns these repairs.
- No Dockerfile, Compose file, committed Supabase configuration, or production database role bootstrap exists.

### CI and deployment

- CI runs lint, typecheck, web build, and `go test ./...`.
- The smoke job can succeed by printing a skip notice when its database/Neon secrets are absent. A02 must replace this with deterministic required infrastructure/failure.
- The former Vercel job used unpinned `vercel@latest` and conditionally skipped when secrets were absent.
- The former Fly job used `superfly/flyctl-actions/setup-flyctl@master` and conditionally skipped both for a missing token and missing `apps/api/fly.toml`.
- Both production deployment jobs were removed on this branch under D-023/A00. No replacement deployment was added.

## 3. Google callback failure evidence

Static evidence strongly supports this sequence:

1. Google/Neon returns to `/auth/complete` with a one-use `neon_auth_session_verifier`.
2. `apps/web/app/auth/complete/page.tsx` immediately calls `authDestination()`.
3. `authDestination()` immediately requests protected GraphQL state.
4. The callback page does not first call the installed auth client's `getSession()` and no auth middleware/proxy processes the verifier.
5. The GraphQL proxy obtains no usable token, returns local HTTP 401, and the client maps that result to the generic “session expired” message.

### Sanitized runtime result — 2026-07-24

The project owner completed Google authentication in the visible local browser. The following safe facts were observed:

1. Quorum initiated Google authorization successfully through the configured Neon flow.
2. Google/Neon returned the browser to local path `/auth/complete`.
3. The callback contained the expected `neon_auth_session_verifier` parameter; only its presence was recorded, never its value.
4. The callback page displayed “Your session has expired or is no longer valid. Please sign in again.” and rendered unauthenticated navigation.
5. The verifier remained in the callback error-page URL rather than being exchanged and immediately removed.
6. The trace tab was navigated to a clean local URL and closed after observation.

This runtime result confirms the static diagnosis at the product boundary: the provider returned a completion verifier, but Quorum attempted protected bootstrap without establishing the browser session. It also confirms a URL-cleanup defect. The browser workflow intentionally did not inspect cookies/session storage and did not record the verifier, OAuth state, challenge, Google account, email, provider response body, or full callback URL. Exact network status classification remains source-proven through the local proxy/client mapping rather than copied from a token-bearing access log.

## 4. Dirty-worktree baseline

At branch creation:

- the audit/living-document changes were already present and intentionally carried to this branch;
- `package-lock.json` had a pre-existing user-owned modification of 121 insertions and 141 deletions;
- A00 has not modified `package-lock.json` and must not normalize it;
- local ignored env files existed but were not tracked.

On 2026-07-24 the owner approved the current lockfile change as the attributable baseline and allowed later removal of demonstrable bloat. Any cleanup must be a focused, reviewed dependency change under A02/A03; it must not silently normalize unrelated entries.

## 5. Containment actions completed

| Action | Result | Evidence |
|---|---|---|
| Create isolated auth-v2 branch | complete | `codex/auth-v2-rewrite` |
| Mark A00 in progress with implementer/reviewer | complete | `docs/auth/STATUS.md` |
| Disable ambiguous legacy production deploys | complete on branch | Vercel/Fly jobs removed from `.github/workflows/ci-cd.yml` |
| Preserve user-owned dependency diff | complete so far | `package-lock.json` not edited by A00 |
| Avoid secret ingestion into evidence | complete | keys only; values excluded |
| Record no-deployment/no-real-data declaration | complete | Owner response dated 2026-07-24; remote Neon is reported empty/disposable, no other remote deployment reported |
| Capture sanitized Google callback runtime evidence | complete | Verifier presence, clean callback path, visible failure, unauthenticated state, and missing URL cleanup recorded without secret values |
| Baseline existing lockfile diff | complete | Owner approved current diff; focused bloat cleanup allowed later |

## 6. Baseline validation

| Command | Result | Notes |
|---|---|---|
| `npm.cmd run lint` | pass | Four pre-existing `react-hooks/exhaustive-deps` warnings; no lint error |
| `npm.cmd run typecheck` | pass | Web TypeScript check completed |
| `npm.cmd run build` | pass | Next 15.5.19 production build completed; same four lint warnings |
| `$env:GOCACHE='D:\quorum\.gocache'; go test ./...` from `apps/api` | pass | All Go packages/tests passed; packages without tests reported normally |

The initial `npm run ...` attempts were blocked by the machine's PowerShell script policy, and the first Go attempt was blocked from the user-level build cache. Those are environment failures, not product-test failures; the commands above are the successful Windows-safe reruns. No database integration/smoke result is claimed because the current suites can skip without deterministic infrastructure, which A02 must repair.

## 7. Owner external-console attestation

The owner supplied the following preliminary declaration on 2026-07-24: there is no remotely deployed/public Quorum application; Neon is the only known remote service; there are no real users or meaningful data; and no other remote host/storage system is in use. This records owner knowledge but does not falsely claim that each provider dashboard was inspected. Exact console checks below remain part of G0. Do not paste secrets or personal data here.

### Read-only Neon aggregate correction — 2026-07-24

A temporary read-only transaction counted tables and safe classifications through the configured server connection. The probe was removed immediately afterward and never printed connection strings or row contents.

| Aggregate | Count |
|---|---:|
| Neon Auth users | 30 |
| Neon Auth accounts | 31 |
| Neon Auth sessions | 48 |
| Product users | 40 |
| Product users using `example.com` test addresses | 37 |
| Other product users | 3 |
| Product users linked to a current Neon Auth user | 21 |
| Product users without a current Neon Auth user | 19 |
| Neon Auth users without a product user | 9 |
| Product tables/projects/teams/messages/notifications and other rows | present |
| All rows across 24 non-system tables | 461 |

No `demo_%` product identities and none of the original fixed migration seed users remain. The majority appears test-generated; the audit intentionally did not inspect names, addresses, messages, tokens, or object contents. After reviewing the aggregate discrepancy, the project owner classified the entire named Neon environment as disposable demo/test data and accepted total loss under D-032. It remains **nonempty** and must not be called empty, but a backup is not required for this specifically accepted dataset.

| Console/system | Required check | State | Safe owner evidence |
|---|---|---|---|
| GitHub repository | deployments/environments/Pages/Actions secrets and integrations | pending dashboard check | No deployed application reported |
| Vercel | verify no project/alias/domain/deployment exists | pending account/no-account confirmation | None reported |
| Fly.io | verify no organization app/volume/domain exists | pending account/no-account confirmation | None reported |
| Neon | enumerate configured database/Auth state without exposing PII and record disposition | complete for configured environment | 40 product users, 30 auth users, 48 sessions; owner accepted disposable loss under D-032 |
| Google Cloud | identify whether a Quorum OAuth client exists and list safe origin/callback names only | pending account/provider confirmation | Legacy development OAuth exists through Neon flow |
| Cloudflare | verify no R2 bucket/custom domain/DNS/tunnel exists | pending account/no-account confirmation | None reported |
| DNS/registrar | verify no Quorum domain/target exists | pending account/no-account confirmation | None reported |
| Other hosts | verify no Railway/Render/Supabase/university/manual deployment exists | pending account/no-account confirmation | None reported |
| Backup/disposable decision | choose verified backup or explicit loss acceptance | complete | D-032 records owner acceptance; no backup required for this named demo/test dataset |

Owner attestation statement to complete:

```text
Date: 2026-07-24
Owner: project owner
Declaration scope: current owner knowledge; individual console checks still pending
Public deployments found: none
Real-user or meaningful data found: owner classified all inventoried rows as demo/test and confirmed no real users
Nonempty databases/object stores and backup evidence: Neon is nonempty; D-032 accepts total loss instead of backup
Disposable environments: configured Neon database/Auth environment, nonempty and preserved until explicit cutover
Unknown/inaccessible systems: none reported for the undeployed POC
Approval to treat the recorded package-lock diff as baseline: yes; demonstrable bloat may be removed in a focused dependency task
```

## 8. A00 exit blockers

- Immediately before destructive cutover, repeat aggregate counts and confirm no public deployment or real users were added.
- Record the exact Neon project/branch/database/Auth target and explicit cutover approval before deletion.
- Invalidate/revoke all 48-or-current legacy sessions at cutover; never copy them into auth v2.

Until these are resolved, do not reset a database, delete Neon/Auth state, rotate away the only working credentials, publish a deployment, or begin A02 dependency changes.
