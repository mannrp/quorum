# A03 Better Auth 1.6.25 acceptance evidence

Date: 2026-07-31
Candidate: exact `better-auth@1.6.25`
Scope: development/test-only code under `apps/web/lib/auth-v2/spike`; no product route mounts the candidate.

This is sanitized A03 review evidence. It does not pass G3; project-owner approval remains mandatory.

## Current matrix

| Verification row | Current result | Evidence |
| --- | --- | --- |
| `SPIKE-COMPAT-001` | Pass | Exact manifest/lock pins cover Better Auth 1.6.25, its previous-patch upgrade fixture, PostgreSQL, Mailpit, and the deterministic OIDC harness. npm registry metadata reports exact 1.6.25/MIT and no engine restriction; local typecheck/build passed with Next 15.5.21 and PostgreSQL 17.10, while CI pins Node 22.23.1. On 2026-07-31, package-and-version-scoped GitHub Advisory Database queries returned no matches for Better Auth 1.6.25, its exact core/telemetry/utils packages, pg 8.22.0, Nodemailer 9.0.3, oidc-provider 9.11.1, or openid-client 6.8.4. The repository-wide npm audit cannot be sent by this agent without separate dependency-graph disclosure approval; its previously recorded unrelated legacy summary is not attributed to the candidate. |
| `SPIKE-PASSWORD-001` | Local pass | Provider-native 29 UTF-16-unit minimum implements D-034 without Quorum plaintext handling. Tests reject 14 maximum-width code points, accept 15 maximum-width code points and 64 ASCII characters, cover Unicode/space/common-value/no-truncation boundaries, and use the maintained HIBP plugin. |
| `SPIKE-SCHEMA-001` | Local pass | Generated/reviewed schema is isolated under `better_auth`; catalog tests reject objects in `public` or reserved Supabase `auth`; runtime and owner roles are separated. |
| `SPIKE-OAUTH-001` | Pass | The exact Better Auth generic OAuth routes complete authorization and callback against the pinned loopback OIDC provider, emitting state and S256 PKCE, using the exact registered callback, persisting one account/session, rejecting modified state, and rejecting code replay. The maintained protocol harness additionally rejects wrong PKCE, wrong nonce, expired code, and replay. The generic OAuth route consumes userinfo and does not rely on an ID token, so an OIDC ID-token nonce is not applicable to that exact route; nonce validation remains proven for the OIDC harness where an ID token is consumed. No provider secret is used. |
| `SPIKE-ROUTES-001` | Local pass | Route inventory and production-boundary tests allowlist the spike surface and prove no production auth-spike route is emitted. |
| `SPIKE-COOKIE-001` | Local pass | Automated attributes prove host-only Secure HttpOnly SameSite cookies. Raw database/internal JSON token values fail as raw cookie and bearer credentials; only the HMAC-signed cookie authenticates. BFF projection tests suppress provider token fields. |
| `SPIKE-SESSION-001` | Local pass | Provider-backed tests cover database sessions, expiry denial, current/other/all revocation, and recent-auth rejection. Session policy enforces 24-hour idle and 7-day absolute limits. |
| `SPIKE-CONTEXT-001` | Local pass | Provider hooks persist `authenticatedAt`, authentication methods, assurance, absolute expiry, and last-seen time. Password and TOTP flows prove AAL1/AAL2 context and refresh-safe recent-auth evaluation. |
| `SPIKE-EMAIL-001` | Local pass | Real Nodemailer-to-Mailpit tests cover verification, reset, and email-change purposes without recording token or message content. |
| `SPIKE-RATE-001` | Local pass | Two provider instances share the database limiter; simulated store outage fails closed. |
| `SPIKE-LINK-001` | Local pass | Configuration disables implicit same-email linking and requires explicit verified-local linking. The exact provider flow rejects an implicit same-email collision, then completes authenticated `/oauth2/link` authorization and callback into the existing user; both credential and OAuth methods resolve to one user. Provider-backed lifecycle tests cover list/unlink and last-method denial. |
| `SPIKE-MFA-001` | Local pass | Maintained Better Auth TOTP plugin covers enrollment, encrypted factor/recovery material, invalid and valid TOTP, AAL2 context, one-use backup code, disable, and factor removal. |
| `SPIKE-SYNC-001` | Local pass | A deliberately lost projection event is detected without granting access and repaired by versioned PostgreSQL reconciliation; later provider updates are detected and repaired. |
| `SPIKE-TOKEN-DB-001` | Pass | Row inspection proves the database token equals the provider's internal token value but cannot authenticate alone as a raw cookie or bearer token; the reusable browser credential is the separately signed secure cookie. Strict role isolation is proven. Final G3 review must retain this distinction and the response projection. |
| `SPIKE-UPGRADE-001` | Local pass | Supported migration API rehearses exact 1.6.24 to 1.6.25, rejects destructive SQL, preserves user/session context, and reaches an empty current schema diff. |
| `SPIKE-PERF-001` | Local pass | Instrumented local run measured create 5 queries/116.642 ms, lookup 4/16.016 ms, and revoke 6/26.444 ms, all within bounded acceptance thresholds. |

## Sanitized commands and results

```text
$env:AUTH_PROVIDER_SPIKE_OPERATOR_DATABASE_URL='<local Docker PostgreSQL operator URL>'; npm.cmd run test:auth-provider-spike --workspace=@quorum/web
13 files passed; 19 tests passed

npm.cmd run test:auth-spike --workspace=@quorum/web
19 files passed; 144 tests passed

npm.cmd run typecheck --workspace=@quorum/web
passed

git diff --check
passed (line-ending notice only)

npm.cmd run test:web
20 files passed; 146 tests passed

npm.cmd run lint
passed with four pre-existing React hook warnings

npm.cmd run typecheck
passed

npm.cmd run build
passed; Next 15.5.21 production route inventory contains no auth-v2 spike route

npm.cmd run test:e2e
1 Chromium test passed

npm.cmd run test:docker-context
passed

$env:QUORUM_REQUIRE_INTEGRATION='true'; $env:QUORUM_TEST_DATABASE_URL='<local Docker PostgreSQL operator URL>'; go test -count=1 ./...
passed, including migration, role, GraphQL, auth, localdb, and storage packages

go vet ./...
passed
```

No password, session token, cookie, OAuth code, state, verifier, nonce, email body, or database row value is recorded here.

## Pinned Ubuntu evidence

- Draft PR: `mannrp/quorum#10`
- Workflow run: `30670240145`
- Job: `91286223141` (`Verify`)
- Runner result: success in 3m03s on 2026-07-31

The job passed repository-history secret scanning, pinned Node and Go setup, clean dependency installation, Docker-context verification, lint, typecheck, production build, API unit tests, canonical migrations, guarded local identity/reset/replay, idempotent role bootstrap, required database integrations, the exact provider spike, web tests, Chromium Playwright, and Mailpit readiness. No secret or credential value is recorded.

## G3 approval

The project owner explicitly approved G3 on 2026-07-31 after final pinned Ubuntu run `30670530686` passed at commit `f7018cd`.
