# Auth v2 verification and evidence plan

**Status:** normative test requirements; commands are added by `A02`  
**Last updated:** 2026-07-24

Security is considered implemented only when observable behavior proves the contract. “Tests pass” without named cases, commands, and evidence is not sufficient.

## 1. Verification principles

1. Test the externally observable contract first; unit tests support but do not replace it.
2. Every allow case has at least one deny/adversarial counterpart.
3. Test direct-ID, list, nested edge, search, export, file, and cached paths separately.
4. Required suites fail when PostgreSQL, Mailpit, browsers, or test configuration are unavailable. No green skip.
5. Use a fresh database for security/integration suites or a unique isolated schema/database per run.
6. Never test production with destructive fixtures. Real-provider smoke uses dedicated test accounts and sanitized evidence.
7. Every fixed audit finding gets a named permanent regression test.
8. Test framework behavior at the browser/HTTP/database boundary; do not trust documentation alone.
9. Performance evidence includes SQL query count and pool state, not only HTTP duration.
10. A coding agent may collect evidence; the project owner approves gates.

## 2. Test layers

| Layer | Purpose | Typical location | Required for |
|---|---|---|---|
| Type/static | Contract shape, generated clients, forbidden imports, lint | web and Go packages | Every task |
| Unit | Policy functions, state machines, claim validation, pure mappings | colocated `*.test.ts`, `*_test.go` | Every behavior change |
| PostgreSQL integration | Constraints, transactions, idempotency, privileges, migrations, queries | Go integration packages / migration tests | A02 onward |
| Next/auth integration | Framework routes, cookies, hooks, database sessions, email | web test server + real local PostgreSQL/Mailpit | A03 onward |
| Internal contract | Next-signed assertion to Go principal/use case | web + Go contract fixtures | A05 onward |
| Browser E2E | Redirects, cookies, multiple tabs, forms, errors, storage | Playwright | A03 onward |
| Adversarial/API | CSRF, replay, spoofing, query cost, rate limits, IDOR/BOLA | integration/security suites | A05 onward |
| Provider contract | Real Google, SMTP, R2, selected host behavior | staging/demo only | G4/G7/G8 |
| Operational | restore, rotation, revocation, outage, rollback | scripts plus reviewed runbook evidence | G8 |
| Performance | realistic dataset, query counts, p50/p95/p99, saturation | load scripts/staging | G8/G9 |

## 3. Target commands

`A02` must create or document stable commands with these responsibilities. Exact implementation may use workspace-specific subcommands, but the root interface should remain memorable.

```sh
npm run infra:up                 # PostgreSQL + Mailpit, health-checked
npm run db:bootstrap-roles       # idempotent local/CI role ownership and grants
npm run db:migrate               # canonical migrations, noninteractive
npm run db:verify                # empty replay + migration/privilege checks
npm run test:web                 # web unit/component
npm run test:api                 # Go unit tests
npm run test:integration         # required DB/auth/internal-contract tests
npm run test:e2e                 # Playwright browser tests
npm run test:security            # adversarial/regression suite
npm run test:all                 # all required non-provider CI gates
```

Existing baseline commands remain required until replaced explicitly:

```sh
npm run lint
npm run typecheck
npm run build
cd apps/api && go test ./...
```

Provider smoke, restore, and load commands must require an explicit environment name and refuse production/destructive targets by default.

## 4. Evidence-row format

Every tracked test row uses:

```text
Test ID:
Invariant IDs:
Audit risk IDs:
Behavior/property:
Positive case:
Negative/adversarial case:
Layer:
Required gate:
Command:
Automated assertion:
Evidence/result:
Owner/date:
```

Evidence is a committed regression test plus a CI/command result. Manual evidence is allowed only where a real provider/browser/platform cannot be deterministic; it must state exactly what was inspected and omit all secrets.

## 5. G3 auth-provider acceptance matrix

Every row is pass/fail for the exact pinned candidate. `A03` remains incomplete until one candidate passes all rows. Automated evidence is preferred; manual inspection states the exact property inspected and is repeated after provider upgrades.

| Test/evidence ID | Required proof | Method and pass rule |
|---|---|---|
| SPIKE-COMPAT-001 | Exact provider version supports pinned Node 22, Next version, PostgreSQL 17, runtime, license, and plugins | Clean install/build/typecheck; no ignored peer error; advisories reviewed |
| SPIKE-PASSWORD-001 | Provider configuration enforces PASS-02 without Quorum plaintext handling | Prove the actual measurement unit and normalization order; reject 14 maximum-width Unicode code points, accept 15 code points where the configured unit permits and at least 64 ASCII characters, cover the 128 target/over-limit boundary, common/breached screening, Unicode/space, paste/password-manager input, and no truncation. Encoded-unit configurations meet D-034's conservative threshold. |
| SPIKE-SCHEMA-001 | Generated objects land only in `better_auth`; migration is reviewable and canonical | Generate against isolated `search_path=better_auth,pg_catalog,pg_temp`; inspect catalogs; fail on any auth object in `public` or Supabase `auth` |
| SPIKE-OAUTH-001 | Maintained code/PKCE/state/nonce/exact callback/one-use behavior | Deterministic local OAuth/OIDC provider or transport harness covers success and negative cases; no provider secret in CI |
| SPIKE-ROUTES-001 | Every mounted auth route/method has an allowlisted purpose and projected response | Route inventory contract test; unknown/unwanted routes return 404/405; no generic token endpoint is exposed |
| SPIKE-COOKIE-001 | Only reusable credential is the opaque secure host-only cookie; helper cookies are purpose-bound | Browser/network/storage inspection plus automated attributes; production unsafe config refuses startup |
| SPIKE-SESSION-001 | Database session, fixation rotation, idle/absolute expiry, current/other/all revocation, and recent-auth behavior are enforceable | Fake-clock/database/browser tests pass at boundaries; revoked cookie denies immediately |
| SPIKE-CONTEXT-001 | Real `authenticated_at`, `amr`, assurance survive refresh/rotation | Before/after persisted session/context assertions; refresh cannot pass recent-auth |
| SPIKE-EMAIL-001 | Verification/reset/email-change hooks and Mailpit adapter expose safe purpose-bound flows | Deterministic mail tests; enumeration/token/log/referrer protections pass |
| SPIKE-RATE-001 | Rate limiting has a defined multi-instance production store/strategy | Two-instance test or explicit POC-local versus production adapter proof; fail-open outage is rejected |
| SPIKE-LINK-001 | Explicit link/unlink and same-email collision behavior match ID-04/ID-08 | Two methods -> one auth user -> one Quorum binding; same email/different auth user never auto-links |
| SPIKE-MFA-001 | Maintained MFA support can provide A07M enrollment, step-up, assurance, factor lifecycle, and recovery | Provider/plugin contract tests; unsupported critical lifecycle rejects candidate for Admin release |
| SPIKE-SYNC-001 | Hook event creation is transactionally coupled or a reconciliation fallback is feasible | Roll back/commit inspection; deliberately lose hook and prove versioned reconciliation detects/repairs without granting stale state |
| SPIKE-TOKEN-DB-001 | Session credential-at-rest behavior is known and accepted | Catalog/row inspection in isolated DB; prefer digest; reusable plaintext requires explicit risk decision and strict role isolation |
| SPIKE-UPGRADE-001 | A pinned supported upgrade has deterministic schema/session compatibility procedure | Upgrade from test fixture of previous accepted patch; canonical migration diff and rollback/forward-fix documented |
| SPIKE-PERF-001 | Session create/lookup/revoke query count and latency are measured | Local representative run with query instrumentation; no unbounded per-request behavior |

Expected commands created or documented by A03 include a focused provider-spike suite and auth-schema catalog check. Do not use `npx ...@latest` in evidence; every CLI/package version is pinned.

## 6. Required authentication and session cases

### Google OAuth

| Test ID | Required behavior | Negative/adversarial cases | Gate |
|---|---|---|---|
| OAUTH-GOOGLE-001 | New user completes Google callback, receives opaque cookie, provisions once, and reaches viewer destination | Missing product provisioning does not look like session expiry | G4 |
| OAUTH-GOOGLE-002 | Returning realm/subject resolves the same product user despite email/display-name change | Same email with different subject does not auto-link | G4 |
| OAUTH-GOOGLE-003 | Framework validates state, PKCE, nonce where applicable, exact callback, and one-use flow state | Missing, modified, expired, replayed, wrong-cookie, and wrong-origin callback | G3/G4 |
| OAUTH-GOOGLE-004 | Provider cancellation/denial returns a safe actionable error | No account/session is created and no protected request runs | G4 |
| OAUTH-GOOGLE-005 | Return destination is a reviewed relative path | External URL, scheme-relative URL, encoded bypass, and nested redirect are rejected | G4 |
| OAUTH-GOOGLE-006 | Suspended/deactivated user is denied immediately and sessions are queued for revocation | Stale auth cookie cannot regain product access | G4/G5 |
| OAUTH-GOOGLE-007 | Duplicate/retried callback is idempotent | Concurrent callbacks create no duplicate user/identity/grant/event | G4 |
| OAUTH-URL-001 | Callback/action page exchanges its one-use value, sets `Referrer-Policy: no-referrer`, loads no third-party resource, and cleans the URL | Browser history, referrer, analytics, logs, redirect chain, and error page reveal no code/token | G3/G4/G5 |

### Password, verification, and recovery

| Test ID | Required behavior | Negative/adversarial cases | Gate |
|---|---|---|---|
| PASS-SIGNUP-001 | Valid password signup creates verification-pending behavior and safe session state | Invalid role, malformed email, common password, oversized input | G5 |
| PASS-POLICY-001 | Approved length/breached-value/Unicode/space/paste/manager policy is enforced exactly by the maintained provider with no silent truncation | Boundary code points/bytes, normalization-equivalent input, leading/trailing space, over-maximum input, composition-only rejection | G3/G5 |
| PASS-LOGIN-001 | Correct credentials create a rotated database session with generic outward failures | Wrong/nonexistent/disabled account, credential stuffing/rate limit, timing/content enumeration | G5 |
| PASS-VERIFY-001 | One-use verification marks the exact identity verified and emits a durable event | Expired, replayed, changed-account, wrong-purpose token | G5 |
| PASS-RESET-001 | Existing and nonexistent reset requests have equivalent outward response | Timing/content enumeration, rate-limit bypass, email flooding | G5 |
| PASS-RESET-002 | Valid reset changes credential and revokes prior sessions | Expired/replayed token; prior cookies rejected | G5 |
| PASS-CHANGE-001 | Authenticated password change requires current/recent proof and rotates/revokes sessions | CSRF, stale session, wrong current password | G5 |
| PASS-EMAIL-CHANGE-001 | Recent-auth change verifies the new address, notifies old, updates through durable sync, and applies token/session policy | Existing-address collision, provider-managed email, stale/replayed token, pending invite/reset, dropped event | G5 |
| PASS-DELIVERY-001 | Verification/reset messages render safe exact links in Mailpit and production provider | Token absent from application logs/analytics | G5/G8 |

### Sessions

| Test ID | Required behavior | Negative/adversarial cases | Gate |
|---|---|---|---|
| SESSION-COOKIE-001 | Cookie is host-only, `HttpOnly`, `Secure` in production, `SameSite`, and `Path=/` | Production startup refuses unsafe cookie/origin configuration | G3 |
| SESSION-EXPOSURE-001 | Auth/session JSON, HTML, browser storage, URLs, and logs contain no reusable credential | Every mounted auth route and error path is inspected | G3 |
| SESSION-FIXATION-001 | Authentication rotates pre-auth state/session | Attacker-chosen/prelogin identifier cannot survive | G3 |
| SESSION-EXPIRY-001 | Idle and absolute limits deny at exact boundaries | Refresh/traffic cannot extend absolute limit | G3/G5 |
| SESSION-AUTH-TIME-001 | `authenticated_at`, `amr`, assurance survive refresh/rotation | Refresh does not satisfy recent-auth gate | G3/G5 |
| SESSION-REVOKE-001 | Revoke current/other/all has exact scope and immediate denial | Old cookie, concurrent request, second browser/tab | G5 |
| SESSION-CROSSTAB-001 | Logout/account switch clears viewer caches in every tab | Back/forward cache and stale GraphQL cache reveal no prior viewer data | G5 |
| SESSION-DEVICE-001 | User sees only own sanitized device handles and may revoke them | Guessing another handle/session ID cannot disclose or revoke | G5 |
| SESSION-SUSPEND-001 | Go denial commits before durable auth revocation; worker retries until complete | Auth worker/email/DB outage does not restore product access | G5 |
| SESSION-RESTORE-001 | Isolated production restore advances security epoch or removes/revokes all restored sessions before traffic | A pre-backup cookie cannot authenticate after restored service opens | G8 |

### Admin MFA

| Test ID | Required behavior | Negative/adversarial cases | Gate |
|---|---|---|---|
| MFA-ENROLL-001 | Admin privilege remains inactive until maintained factor enrollment and verification complete | Partial/abandoned enrollment, stolen pre-enrollment session | G5A |
| MFA-STEPUP-001 | Privileged command requires recent accepted assurance/`amr` | Password/Google-only session, stale step-up, replayed challenge | G5A |
| MFA-FACTOR-001 | Factor list/add/remove/change requires exact recent proof and revokes/rotates sessions as specified | Remove last factor, cross-account factor ID, concurrent factor change | G5A |
| MFA-RECOVERY-001 | Lost-factor/recovery/backup material follows audited controlled flow | Reused recovery code, enumeration, standing bypass, initial bootstrap reuse | G5A |
| MFA-OUTAGE-001 | Provider/storage outage denies privileged action safely | No emergency email allowlist or MFA-off flag | G5A/G8 |

### Privileged invitations and grants

| Test ID | Required behavior | Negative/adversarial cases | Gate |
|---|---|---|---|
| INVITE-ISSUE-001 | Authorized Admin issues a scoped Professor invitation whose raw token is delivered once and only its digest is stored | Non-Admin issuer, invalid role/scope, raw token in database/log/audit/evidence | G6 |
| INVITE-ACCEPT-001 | Recent authenticated user with fresh matching verified-identity proof atomically consumes invitation and receives one audited grant | Browser email, unverified/stale email, wrong account/scope/purpose, concurrent acceptance | G6 |
| INVITE-LIFECYCLE-001 | Expired, revoked, superseded, replayed, or mismatched invitation grants nothing and reveals no account/invite details | Reissue leaves old token valid, reuse by second account, timing/content enumeration | G6 |
| INVITE-IDEMPOTENCY-001 | Retry by the same accepted user returns the same result without duplicate grants/events | Lost response, duplicate delivery, concurrent worker/request retry | G6 |
| ADMIN-GRANT-001 | Initial bootstrap is one-use and subsequent Admin grants require an existing authorized Admin with recent MFA and complete audit | Editable email, `ADMIN_EMAILS`, bootstrap reuse, missing/replayed MFA, self-grant bypass | G5A/G6 |

## 7. Internal boundary cases

| Test ID | Required behavior | Negative/adversarial cases | Gate |
|---|---|---|---|
| INT-JWS-001 | Valid short-lived assertion authenticates Next and identifies a realm/subject | Missing signature; browser-supplied header; wrong algorithm/type/key | G4 |
| INT-JWS-002 | Go validates issuer, audience, `iat`, `nbf`, `exp`, lifetime, key rotation, and bounded skew | Early, expired, over-60-second, wrong audience/issuer, unknown key amplification | G4 |
| INT-PRINCIPAL-001 | Go resolves current internal user, status, grants, and relationships | Assertion role/email/profile hints are absent or ignored | G4/G6 |
| INT-PRINCIPAL-002 | Unknown/suspended/deleted subject denies consistently | No automatic user creation on arbitrary internal call | G4 |
| INT-CONTRACT-001 | Next and Go contract fixtures/generated client agree | Removed/renamed fields fail CI; one compatible rolling version works | G4/G8 |
| INT-RESILIENCE-001 | Deadline, cancellation, correlation, overload, and idempotency propagate | Nonidempotent commands are not automatically retried | G8 |
| INT-ANON-001 | Workload-authenticated `ANONYMOUS` variant can call only explicit public operations and has no subject | Fabricated subject, anonymous call to authenticated operation, authenticated-claim confusion | G4/G6 |
| INT-BINDING-001 | Assertion `sub` is accepted-provider user ID; multiple provider accounts below it resolve one Quorum user | Google/provider subject used as product binding, provider collision, same-email auto-merge | G4 |
| INT-TRANSPORT-001 | Selected production transport provides request/response confidentiality and integrity in addition to JWS | Interception/body-operation tamper and plaintext/private-network downgrade | G8 |
| INT-REPLAY-001 | Captured assertion works no longer than the documented mint window and is rejected after expiry | Replay after logout inside/outside window is measured/documented; no claim of immediate retroactive erasure | G4/G8 |
| SYNC-EVENT-001 | Transactional outbox or reconciliation processes duplicate/reordered/dropped auth events idempotently | Poison event, worker crash, stale verified-email snapshot, event backlog | G5/G8 |
| SYNC-RECON-001 | Version/status/freshness detects missed hook and repairs provider/product state | Reconciler outage or stale state causes gated action to fail closed | G5/G8 |
| BFF-CSRF-001 | Custom state-changing route validates exact origin, Fetch Metadata/CSRF, content type, body, and session | Missing/`null`/cross-site origin, simple-form content type, forged helper token | G4/G5 |
| BFF-HOST-001 | Security-sensitive URLs derive from configured canonical origin and trusted proxy only | `Host`, `Forwarded`, `X-Forwarded-Host/Proto` spoof and tunnel/proxy misconfiguration | G4/G8 |
| BFF-CACHE-001 | Session/viewer responses are `no-store` or keyed by every security dimension; logout clears all scopes | Shared cache, back-forward cache, account switch, cross-tab stale data | G5/G8 |
| BFF-ROUTE-001 | Browser can invoke only typed/allowlisted BFF operations | Arbitrary GraphQL document, internal URL proxying, method/path confusion | G4/G6 |
| VIEWER-BOOTSTRAP-001 | `ViewerBootstrapV1` returns exactly its approved self projection with `private, no-store` | Anonymous, unknown/inactive/ambiguous principal; browser identity/role input; provider subject, auth ID, email, privileged grant, session value, private profile, or file URL in output | G4 |

## 8. Authorization generation

Do not hand-write a few happy-path resolver tests and call the matrix covered. Generate/table-drive cases from an implementation data table containing:

```text
operation or field
actor grants
account state
relationship
resource state
requested action
expected allow/deny
allowed output fields
```

Required variants for every relevant operation:

- anonymous;
- authenticated but unverified;
- correct role without relationship;
- correct relationship with wrong resource state;
- owner/self;
- another user with same role;
- scoped Professor inside/outside scope;
- Admin with/without recent MFA where required;
- suspended/deactivated/deleted account;
- direct ID versus list versus nested edge;
- changed object between check and transaction;
- cache/load-batch entry created for a different viewer.

Representative permanent IDs:

| Test ID | Policy |
|---|---|
| AUTHZ-ROLE-001 | Only self-service Student/Sponsor grants; Professor/Admin require controlled audited commands |
| AUTHZ-ADMIN-001 | Editable/spoofed email and legacy `ADMIN_EMAILS` never grant privilege |
| AUTHZ-PROJECT-001 | Anonymous sees only approved/published sanitized summaries |
| AUTHZ-PROJECT-002 | Sponsor cannot set approval/lifecycle/owner through generic create/update input |
| AUTHZ-PROJECT-003 | Draft/rejected/archived direct-ID visibility equals list policy |
| AUTHZ-TEAM-001 | Team lead cannot associate arbitrary project without accepted workflow relationship |
| AUTHZ-APP-001 | Application answers/messages/review/offer fields are limited to exact participants/reviewers |
| AUTHZ-PROFILE-001 | `profileComplete`, role, state, and sensitive fields are server-derived/dedicated commands |
| AUTHZ-FIELD-001 | Public/self/reviewer/admin response projections contain only allowlisted fields |
| AUTHZ-STATE-001 | Every product operation denies inactive account states |

## 9. GraphQL and abuse cases

| Test ID | Required behavior | Negative/adversarial cases | Gate |
|---|---|---|---|
| GQL-ALLOWLIST-001 | Registered operation ID and valid variables execute | Raw query, unknown hash/ID, operation-name confusion | G6/G8 |
| GQL-DEPTH-001 | Depth maximum enforced before expensive work | Fragments, cycles, inline fragments at boundary | G8 |
| GQL-AMOUNT-001 | Aliases/fields/operation count and variables are bounded | Many aliases, repeated expensive fields, oversized lists | G8 |
| GQL-COST-001 | Viewer-aware cost and rate budget rejects amplification | Cheap-root/expensive-nested and multi-request bursts | G8 |
| GQL-PAGE-001 | Every list has cursor/maximum and stable ordering | Missing/huge/negative page size, cursor tampering | G8 |
| GQL-LOADER-001 | Loader batching reduces query count and keys by viewer/policy where needed | Cross-viewer cached disclosure, unauthorized prefetch | G8 |
| GQL-ERROR-001 | Errors are stable/sanitized with correlation ID | SQL/internal path/provider detail is absent | G8 |
| ABUSE-AUTH-001 | Signup/login/reset/resend limits work at account, network, and global levels | IPv6 rotation/basic distributed bypass scenarios | G5/G8 |
| ABUSE-UPLOAD-001 | Upload count/bytes/type/purpose quotas enforced before signing | Parallel intents and abandoned uploads | G7/G8 |

## 10. File cases

| Test ID | Required behavior | Negative/adversarial cases | Gate |
|---|---|---|---|
| FILE-PRIVATE-001 | New and migrated resumes/documents are private object keys | Public-domain configuration cannot produce durable public URL | G7 |
| FILE-UPLOAD-001 | Intent/finalization enforce owner, resource, purpose, type, size, quota, expiry | MIME/extension mismatch, oversized object, wrong key, replay | G7 |
| FILE-SCAN-001 | Required quarantine/scan state blocks use until clean | Scanner timeout/failure, archive/polyglot policy | G7 |
| FILE-DOWNLOAD-001 | Current policy precedes every short-lived signed download | Unrelated user, revoked relationship, expired URL, changed resource state | G7 |
| FILE-CLEANUP-001 | Replacement/deletion/orphan cleanup is idempotent and observable | R2/DB partial failure retries safely | G7/G8 |
| FILE-R2-001 | Real R2 contract matches emulator/fake assumptions | Unsupported S3 behavior fails visibly | G7/G8 |

## 11. Configuration, migration, and operations cases

| Test ID | Required behavior | Negative/adversarial cases | Gate |
|---|---|---|---|
| CONFIG-PROD-001 | Production startup validates exact secure origin, cookie, service keys, provider, DB, R2, and email config | Missing, placeholder, development, insecure scheme, malformed value | G8 |
| CONFIG-DEMO-001 | Production refuses demo/reset/persona/test auth features | Header/cookie impersonation does nothing when disabled | G0/G8 |
| CONFIG-CLIENT-001 | Backend origins/secrets are server-only | No `NEXT_PUBLIC_*` fallback points browser/server to Go | G8 |
| MIG-EMPTY-001 | Empty database reaches current schema from canonical migrations | Missing extension/version/ordering causes CI failure | G2 onward |
| MIG-UPGRADE-001 | Previous supported schema upgrades without data loss | Concurrent instance/migration, lock timeout, partial failure | G8 |
| MIG-PRIV-001 | Runtime roles have least privilege and cannot DDL/cross-read | Go cannot read auth credentials; auth cannot mutate product policy | G4/G8 |
| MIG-SCHEMA-001 | Accepted auth objects land only in dedicated schema under explicit transaction search path | Unqualified generated DDL creates in `public` or Supabase `auth` | G3/G4 |
| MIG-LOCK-001 | Migrator fails on missing manifest/checksum drift and serializes with advisory lock/timeouts | Concurrent release, modified applied file, zero discovered migrations | G2/G8 |
| MIG-ROLES-001 | Idempotent cluster-role bootstrap precedes schema restore/migration and default privileges remain least-privilege | Missing globals, runtime ownership/CREATE, `PUBLIC`/Data-API grants | G2/G8 |
| MIG-RESET-001 | Local reset requires the separate local test URL plus matching instance marker and is absent from production image | Remote/provider/production-shaped DB, missing/mismatched marker, misleading `APP_ENV` | G2/G8 |
| OPS-RESTORE-001 | Encrypted backup restores to a separate environment and passes integrity tests | Missing key, stale runbook, incompatible version | G8 |
| OPS-ROTATE-001 | Session/JWS/Google/R2/DB/email secret rotation preserves or deliberately revokes service | Old key expiry, mixed rolling versions, compromised key | G8 |
| OPS-OUTAGE-001 | Google/email/R2/DB/Go/Next outages fail safely and recover | Queue backlog, duplicate delivery, partial dependency recovery | G8 |
| OPS-ROLLBACK-001 | Previous compatible app version can be restored without unsafe schema/session resurrection | Destructive migration or revoked legacy path cannot be revived | G8 |
| OPS-TLS-001 | Managed database connection enforces and verifies CA/hostname; live connection reports SSL | `sslmode=require`, wrong CA/host, plaintext fallback | G8 |
| OPS-WORKER-001 | Separate worker leases, retries, quarantines poison, shuts down gracefully, and exposes backlog age | Fire-and-forget request work, two-worker duplicate, stuck backlog | G8 |
| OPS-HEALTH-001 | `/livez` tests process only; private `/readyz` verifies DB/schema/required dependency readiness without details | Liveness tied to DB causes restart loop; public health leaks provider/schema | G8 |
| OPS-SUPPLY-001 | Actions/CLIs/images are exact/SHA/digest pinned and secrets are step-scoped under least GitHub permissions | `@master`, `@latest`, job-wide secret visibility, build secret in layer | G8 |
| OPS-COMPAT-001 | N-1 app and rollback image support every predeploy migration; image/schema ranges are recorded | Contract migration before old readers/writers retire | G8 |

## 12. Audit risk traceability

| Audit ID | Required regression/evidence | Work task |
|---|---|---|
| Q-AUTH-01 | AUTHZ-ADMIN-001 | A08/A11 |
| Q-AUTH-02 | SESSION-SUSPEND-001, AUTHZ-STATE-001 | A07/A08 |
| Q-AUTH-03 | INT-JWS-001/002 plus removal of legacy verifier | A05/A11 |
| Q-AUTH-04 | AUTHZ-PROFILE-001 | A08 |
| Q-AUTHZ-01 | AUTHZ-APP-001, AUTHZ-FIELD-001 | A08 |
| Q-AUTHZ-02 | AUTHZ-PROJECT-002 | A08 |
| Q-AUTHZ-03 | AUTHZ-TEAM-001 | A08 |
| Q-AUTHZ-04 | AUTHZ-PROJECT-003 and direct/list/nested generated cases | A08 |
| Q-DATA-01 | FILE-PRIVATE-001 | A10 |
| Q-DATA-02 | FILE-DOWNLOAD-001 plus exact relationship matrix | A08/A10 |
| Q-DEMO-01 | CONFIG-DEMO-001 | A00/A11 |
| Q-SESSION-01 | SESSION-EXPOSURE-001 | A03/A07 |
| Q-SESSION-02 | OAUTH-GOOGLE-001, INT-PRINCIPAL-001, SESSION-SUSPEND-001 | A06/A07 |
| Q-SESSION-03 | SESSION-CROSSTAB-001 | A07 |
| Q-API-01 | GQL-ALLOWLIST/DEPTH/AMOUNT/COST/PAGE tests | A09 |
| Q-API-02 | AUTHZ-FIELD-001 | A08 |
| Q-PERF-01 | GQL-LOADER-001 and performance/query-count plan | A09/A12 |
| Q-REG-01 | OAUTH-GOOGLE-007 and identity provisioning transaction tests | A04/A06 |
| Q-OBS-01 | stable error/event/correlation assertions and operations evidence | A05-A11 |
| Q-SUPPLY-01 | removal of beta Neon dependency plus pinned accepted framework evidence | A03/A11 |
| Q-TEST-01 | G2 mandatory browser/integration gates and no-skip assertion; when D-033 is used, exact pinned Ubuntu evidence before G3 | A02/A03 |
| Q-DEPLOY-01 | CONFIG-CLIENT-001, INT-JWS suite, deployed private-topology evidence | A05/A11 |

## 13. Performance and scalability evidence

Create a deterministic provisional dataset, adjusted if product evidence later differs:

- 800 users across Student/Sponsor/Professor/Admin grants;
- 200 teams with realistic memberships;
- 100 projects across lifecycle states;
- 1,000 applications with answers/messages/offers;
- representative private file metadata, notifications, and audit events.

Measure at least:

- login completion after the provider callback, with third-party time separated;
- viewer/session lookup;
- project discovery;
- dashboard;
- team detail;
- application submit and project-owner review;
- resume authorization/signing.

Record:

- cold and warm end-to-end p50/p95/p99;
- SQL query count and cumulative SQL time per operation;
- Next-to-Go hop time;
- database pool use/waits/saturation for both runtimes;
- CPU/memory, error/timeout/rate-limit counts;
- response bytes and cache behavior;
- 20-concurrent-user baseline and at least one controlled overload test.

Set numeric release budgets after the first representative baseline and owner review. CI must thereafter block material regression. Do not use Go-versus-Java/Node microbenchmarks as product performance evidence.

## 14. Evidence hygiene

Allowed:

- test names and pass/fail counts;
- redacted cookie attribute names without values;
- redacted headers and redirect URLs without codes/tokens;
- synthetic internal IDs;
- CI/commit/PR links;
- aggregate performance and query counts.

Forbidden:

- cookie/token/code/verifier/reset/verification values;
- private JWS keys or full signed assertions;
- database/R2/SMTP credentials or connection strings;
- real resumes, messages, emails, or names;
- screenshots of provider consoles containing secrets;
- raw database dumps.

If evidence cannot be safely sanitized, record that the owner inspected it, what properties were checked, and the date—never paste the sensitive artifact.
