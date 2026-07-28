# Auth V2 acceptance-spike harness

This directory is a development/test-only acceptance harness. It is not an auth
provider, is not mounted by a Next route, and must not be imported by production
application code. `boundary.ts` additionally requires both
`AUTH_PROVIDER_SPIKE_ENABLED=true` (supplied as `spikeEnabled`) and a
`development` or `test` runtime before candidate code can load.

No harness result completes A03 or passes G3. Every `SPIKE-*` row still requires
evidence from one accepted application auth provider and the pinned Ubuntu job.

## Pinned protocol fixtures

| Package | Exact version | Use | License | Integrity source |
| --- | --- | --- | --- | --- |
| `oidc-provider` | `9.11.1` | Loopback-only maintained OAuth/OIDC authorization server | MIT | `package-lock.json` |
| `openid-client` | `6.8.4` | Maintained discovery, state, nonce, PKCE, callback, token, and ID-token validation | MIT | `package-lock.json` (`sha512-QSw0BA...`) |

The OIDC fixture uses a public client (`token_endpoint_auth_method=none`), so CI
needs no client secret. Its in-memory adapter, development signing keys, and
development interaction UI are deliberately confined to the loopback test
fixture. They are prohibited for product authentication.

The repository pins Node `22.23.1`. The local run on 2026-07-26 used Node
`24.18.0`; therefore local success is not Node 22 evidence. Exact Node 22
compatibility remains unchecked until the pinned Ubuntu workflow runs.

## Implemented candidate-neutral controls

These are harness capabilities, not provider acceptance results:

- strict development/test boundary and lazy provider loading;
- route/method/purpose allowlist, 404/405 behavior, explicit response
  projection, validated session cookies, and `Cache-Control: no-store`;
- exact-origin mutation checks and secure host-only cookie assertions;
- maintained live OIDC success plus wrong callback, missing/wrong PKCE, wrong
  state, wrong nonce, code replay, and code-expiry controls;
- D-031 Unicode-code-point password boundary vectors (never runtime password
  validation);
- 24-hour idle, 7-day absolute, 10-minute recent-auth, rotation, and preserved
  authentication-context acceptance oracles;
- local-only Mailpit API polling that keeps message bodies inside an exercise
  callback and emits no message content or identifier as evidence;
- enumeration-parity, purpose-bound email-link, no-store, and no-referrer
  checks;
- exact `better_auth,pg_catalog,pg_temp` search-path and catalog-isolation
  checks;
- credential-at-rest classification using in-memory equality fingerprints,
  never recorded credentials or fingerprints;
- two-instance/shared-store/fail-closed rate-limit trace checks;
- explicit identity linking, same-email collision isolation, and safe unlink
  trace checks;
- maintained-provider MFA lifecycle capability checks;
- transactional event/rollback or versioned reconciliation-fallback checks;
- sanitized query-count and latency summaries.

Provider-backed database, browser, Mailpit, lifecycle, linking, MFA, rate-limit,
event, and performance runs remain pending. The harness must never be cited as a
substitute for those runs.

## Advisory disposition (2026-07-26)

`npm audit --json` after adding the two exact fixture packages reported nine
repository-wide findings: three moderate, five high, and one critical. Neither
`oidc-provider` nor `openid-client` appeared in the vulnerable dependency map.
The findings are in pre-existing legacy Neon Auth/Better Auth and Next build
paths. In particular, the critical Better Auth finding is nested under the
legacy `@neondatabase/auth` dependency; it is not the removed A03 candidate.
This observation does not waive remediation or constitute a clean production
audit.

Do not run `npm audit fix` or `--force` as part of this spike: it can rewrite
unrelated dependencies and violate the focused-lockfile rule.

## Deterministic fixture upgrade procedure

1. Start from a clean branch and record the current exact versions and lockfile
   integrity entries.
2. Query registry metadata for each proposed exact version:

   ```powershell
   npm.cmd view oidc-provider version license dependencies dist.integrity --json
   npm.cmd view openid-client version license dependencies dist.integrity --json
   ```

3. Review the maintainers' changelogs and security advisories. Do not accept a
   cached search result as proof of the current release.
4. Install only exact development versions:

   ```powershell
   npm.cmd install --save-dev --save-exact oidc-provider@<exact> openid-client@<exact> --workspace @quorum/web
   ```

5. Confirm that only `apps/web/package.json`, the focused lockfile entries, and
   intentional harness changes moved. Never normalize unrelated lock entries.
6. Run `npm.cmd audit --json` and attribute every vulnerable path. Do not hide a
   finding by omitting dev dependencies from the review.
7. Run the focused OIDC tests, then `npm.cmd run test:web`, web typecheck, lint,
   and the production build. The build must contain no mounted spike route.

   ```powershell
   npm.cmd run test:auth-spike --workspace @quorum/web
   ```
8. Run the same commands under repository-pinned Node `22.23.1` on Ubuntu before
   recording compatibility evidence.
9. Keep the previous exact fixture versions available in the preceding commit.
   Roll back by reverting the focused manifest/lockfile/harness commit; never
   retain a partially upgraded fixture.

Application-provider schema/session upgrade testing is separate and remains a
pending `SPIKE-UPGRADE-001` requirement.

## Better Auth candidate checkpoint (2026-07-27)

Exact current stable `better-auth@1.6.25` is installed as a development-only candidate. Service-backed tests use the reviewed transient schema fixture and pinned loopback PostgreSQL; they prove the conservative D-034 boundary, credential hashing, schema isolation, runtime grants, origin rejection, signed-cookie-only session reuse, shared database rate limiting, and fail-closed rate-store behavior. This is a checkpoint, not provider or G3 acceptance; all remaining `SPIKE-*` evidence and pinned Ubuntu CI remain mandatory.