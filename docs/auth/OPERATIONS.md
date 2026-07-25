# Auth v2 development, deployment, and operations guide

**Status:** target runbook; infrastructure is created by `A02` and `A11`  
**Last updated:** 2026-07-24

This guide deliberately separates local development, a disposable demonstration, a public pilot, and university/self-hosted production. “It runs in Docker” does not make those environments operationally equivalent.

## 1. Local infrastructure decision

Use a lean Docker dependency stack by default:

```text
Developer host
├── Next.js dev server :3000
├── Go dev server :8080
└── Docker
    ├── PostgreSQL :54322
    └── Mailpit SMTP :1025 / UI :8025
```

Next and Go run on the host for the fastest Windows hot-reload loop. `A11` also builds production Docker images, and an optional Compose profile runs the whole product for deployment parity.

### Why not the full local Supabase stack?

The selected application architecture uses Better Auth, Go product policy, direct PostgreSQL connections, and R2. The Supabase CLI local stack includes PostgreSQL plus Auth, PostgREST, Realtime, Storage, gateway, Studio, Edge Runtime, local mail, observability helpers, and more. It is explicitly a development/test environment—not a production stack—and currently expects substantial Docker resources. [Supabase local CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [Supabase self-hosting distinction](https://supabase.com/docs/guides/self-hosting)

Running those unused services would:

- create a second auth and API surface that Quorum must ensure nobody uses;
- encourage a second `supabase/migrations` history beside `apps/api/migrations`;
- make the `public` schema look like a browser API even though Go owns policy;
- consume more memory/startup time without improving application portability;
- imply that local CLI containers can be promoted to production, which they cannot.

The portable artifacts are standard PostgreSQL migrations, ordinary connection strings, R2/S3-compatible storage boundaries, and the Next/Go application images.

If Quorum later deliberately adopts Supabase Auth, Storage, Realtime, or Data API, add a superseding ADR and reconsider the local stack. Do not add it for the brand name alone.

## 2. Infrastructure artifacts to implement

`A02` creates:

```text
.dockerignore
compose.dev.yml
```

The two env example files already exist. A02 updates them additively or adds clearly named auth-v2 example sections; it does not delete legacy runtime-required variables until A11, and labels every legacy variable as non-target.

`A11` adds:

```text
apps/api/Dockerfile
apps/web/Dockerfile
deploy/compose/compose.yaml
deploy/compose/.env.example
```

Optional local object-storage emulation belongs behind a Compose `storage` profile. It validates workflow shape only; a real-R2 test remains required.

### Root `.dockerignore` minimum

Exclude at least:

```text
.git
.agents
.codex
.planning
**/.env
**/.env.*
!**/.env.example
node_modules
**/node_modules
.next
**/.next
.turbo
**/.turbo
.gocache
*.log
*.tsbuildinfo
coverage
dist
**/dumps/
**/backups/
**/*.dump
**/*.backup
**/*.pem
**/*.key
**/*.p12
**/*.pfx
**/id_rsa*
```

Do not exclude canonical `*.sql` migrations. At A02, verify the actual build-context archive with planted sentinel files; at A11, also inspect built image layers/SBOM. A pattern in a file is not evidence by itself.

## 3. Local service contract

### PostgreSQL

- Start from PostgreSQL 17 under D-027. During `A02`, pin an exact supported patch image and digest after checking `pgcrypto`, `pg_trgm`, pgx, accepted auth provider, and likely managed-host compatibility; record any major-version change as a sub-decision.
- Enable and test `pgcrypto` and `pg_trgm`, which current migrations require.
- Use a named volume. Normal `infra:down` must preserve it.
- Bind the development database only to loopback.
- Use health checks before migrations/tests start.
- Do not use production credentials or copied production data.

Example local-only connection shape:

```text
postgres://quorum_dev:<local-only-password>@127.0.0.1:54322/quorum?sslmode=disable
```

Inside Compose, services use the database service DNS name, not `localhost`:

```text
postgres://quorum_app:<local-only-password>@postgres:5432/quorum?sslmode=disable
```

### Mailpit

- Bind SMTP and the web UI to loopback in development.
- Better Auth sends verification/reset mail through SMTP; it does not implicitly know about Mailpit.
- Tests query Mailpit or the test mail adapter deterministically and never scrape arbitrary developer mail.
- Treat verification/reset URLs as secrets. Do not place them in committed evidence.

### Application processes

- Browser origin: `http://localhost:3000` during local development.
- Host-run Go: `http://127.0.0.1:8080`, called only by the Next server.
- Container-run Go: internal service DNS/port and no published host port in the production-shaped profile.
- Remove `NEXT_PUBLIC_API_URL` as the server backend-origin fallback. The internal Go URL is server-only configuration.
- Production config requires HTTPS and secure cookie behavior.

## 4. Safe local commands

`A02` must provide documented scripts with behavior equivalent to:

```sh
npm run infra:up
npm run db:migrate
npm run dev:api
npm run dev:web
```

Normal shutdown preserves data:

```sh
npm run infra:down
```

Local reset is intentionally explicit and is never packaged into a production image:

```sh
QUORUM_ALLOW_LOCAL_RESET=true npm run db:reset:local
```

On Windows, implement an equivalent cross-platform Node/Go guard rather than requiring POSIX environment syntax. The reset command consumes a separate `LOCAL_TEST_DATABASE_URL`, never the generic production `DATABASE_URL`, and verifies all of the following before deleting local data:

- the command itself is running from the development toolchain, not a release container;
- address is loopback or the exact local Compose network identity;
- database name is the documented test/dev name;
- the explicit reset flag is present;
- a random local instance marker in an ignored host file exactly matches `quorum_meta.environment_identity` inside that database;
- the marker exists and identifies the current Compose project;
- no provider/remote address is permitted, regardless of `APP_ENV` or database name.

The marker is created by local bootstrap, verified before reset, and recreated only as part of the guarded local reset. A production one-VM database may also be named `postgres`/`quorum`; hostname, name, and `APP_ENV` alone are never sufficient proof of safety.

Never teach contributors to use an undocumented `docker compose down -v` as the normal reset workflow.

## 5. Migration ownership

Canonical migration directory:

```text
apps/api/migrations
```

Current Quorum migration tracking uses `schema_migrations`. Supabase CLI uses a different `supabase_migrations.schema_migrations` history. Running both would create two authorities, so auth v2 does not introduce `supabase/migrations` or use `supabase db push`.

### Better Auth schema changes

For the exact pinned framework version:

1. Create `better_auth` and configure the isolated generation/migration connection with search path exactly `better_auth, pg_catalog, pg_temp`.
2. Use the pinned Better Auth CLI to **generate** SQL in an isolated database/worktree whose search path is exactly `better_auth, pg_catalog, pg_temp`—not `better_auth, public`.
3. Review table names, token fields, indexes, constraints, defaults, plugin tables, and privileges. Schema-qualify every created object or begin the canonical migration transaction with equivalent `SET LOCAL search_path` plus `current_schema() = 'better_auth'` assertion.
4. Convert the reviewed SQL into the next canonical `apps/api/migrations/<version>_<name>.sql` file. CI queries the catalogs and fails if any accepted-provider auth object exists in `public` or Supabase `auth`.
5. Apply through Quorum's migrator in local, CI, staging, and production release jobs.
6. Never run framework auto-migration from application startup.

Better Auth documents PostgreSQL and non-default-schema support, but `A03` must prove the exact version and adapter behavior. [Better Auth PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql), [Better Auth database CLI](https://better-auth.com/docs/concepts/database)

### Migrator hardening in A02

This is completed before A04 creates auth-v2 schema, not deferred to release. The migrator must add or prove:

- a dedicated `MIGRATOR_DATABASE_URL`, distinct from both runtime URLs;
- deterministic embedded/manifested discovery that fails when the expected directory/manifest is missing or no migrations are found;
- a database advisory lock so two deploys cannot migrate concurrently;
- unique ordered versions and migration checksums/immutability detection;
- statement/lock timeouts appropriate to the migration;
- transactional execution where supported;
- nonzero failure and no application rollout after migration failure;
- current schema version in health/operations output without exposing credentials;
- explicit forward-fix/rollback notes and N-1 compatibility metadata;
- empty-database replay and previous-version upgrade tests.

The default runner executes each migration transactionally and rejects migrations declared nontransactional. If a future operation cannot run in a transaction, add a separate reviewed execution path and failure-recovery ADR; do not silently bypass the wrapper.

### Cluster role bootstrap and ownership

PostgreSQL roles are cluster-global and ordinary schema/data dumps do not recreate them. Provide an idempotent operator-only `db:bootstrap-roles` step using provider-admin credentials before schema migration or restore:

- create NOLOGIN schema-owner roles;
- create LOGIN `quorum_migrator`, `quorum_auth_runtime`, and `quorum_app_runtime` roles through provider/secret-manager supplied credentials;
- runtime roles own nothing, have no `CREATE`, and do not inherit broad provider roles;
- revoke `CREATE ON SCHEMA public FROM PUBLIC`;
- grant explicit schema/table/sequence/function rights only;
- set `ALTER DEFAULT PRIVILEGES FOR ROLE <owner>` so future objects do not regain public/broad access;
- revoke current/default privileges from Supabase `anon`, `authenticated`, and `service_role` on Quorum schemas when the Data API is unused;
- verify each runtime credential cannot cross its boundary.

Role passwords/secret material never appear in migration SQL or dumps. Backup/restore documentation records role definitions/ownership separately and recreates globals before restoring schema/data. Managed Supabase custom-role capabilities and provider-admin limitations must be verified during A11. [Supabase PostgreSQL roles](https://supabase.com/docs/guides/database/postgres/roles), [restricted superuser model](https://supabase.com/docs/guides/database/postgres/roles-superuser)

Schema changes are made through reviewed migration files only—never a managed-host dashboard editor.

## 6. Managed Supabase PostgreSQL compatibility

Managed Supabase remains a valid database candidate because Quorum uses direct PostgreSQL, not Supabase's browser APIs.

If selected:

- create a new project in the chosen region;
- enable Supabase server-side SSL enforcement; production clients use `sslmode=verify-full` with the project CA and verify hostname/certificate. `sslmode=require` encrypts without full identity verification and is not production acceptance; CI/staging verifies the live connection through `pg_stat_ssl` plus a wrong-CA/host negative test;
- use the documented direct IPv6 connection for persistent hosts when reachable, otherwise Supavisor session mode for IPv4-only persistent hosts. Use transaction mode only for truly ephemeral/serverless work after proving driver compatibility; it does not support prepared statements;
- disable the Data API if unused, or remove application/auth schemas and grants from its exposure;
- never place Better Auth tables in the reserved `auth` schema;
- never put a service-role/secret key in the browser or use it as the normal DB credential;
- create separate least-privilege migrator, auth-runtime, and app-runtime roles;
- use small explicit pools in Next, Go, and workers. Record `sum(max_instances × pool_max for each service) + migrator/operations headroom` below an owner-approved fraction of the database connection maximum, and load-test waits/saturation through the exact selected endpoint/role;
- test prepared-statement compatibility before choosing a transaction pooler mode;
- keep all schema changes in `apps/api/migrations` and execute the Quorum migrator as a release job.

Supabase recommends direct connections for persistent servers where supported and describes session/transaction pooler tradeoffs. [Connecting to Supabase PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres). It documents server-side [SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement) and supports disabling the Data API for direct-connection architectures. [Securing/turning off the Data API](https://supabase.com/docs/guides/api/securing-your-api)

Portability must be tested periodically:

1. apply migrations to empty vanilla PostgreSQL;
2. run repository/auth/integration tests;
3. `pg_dump` and restore into a second empty PostgreSQL instance;
4. rerun tests;
5. repeat against the intended managed Supabase PostgreSQL major before release.

Avoid dependencies on Supabase platform schemas/roles/helpers unless a new ADR deliberately accepts them.

## 7. Docker application images

### Next image

- Use a production Node runtime supported by the pinned Next/Better Auth versions.
- Prefer Next standalone output/multi-stage build where supported.
- Run as a non-root user with a read-only filesystem where practical.
- Inject runtime secrets at runtime, not build arguments.
- The image must build without real credentials and must initialize provider/database clients only from runtime-injected configuration.
- Expose only the Next HTTP port.
- Provide `/livez` for process/event-loop health only and `/readyz` for required auth DB/config/worker-facing readiness without revealing session/provider details.

### Go image

- Multi-stage compile a static/minimal binary where dependencies permit.
- Run as a non-root user in a minimal image.
- No shell/debug tools in the release image unless justified.
- Do not publish the Go port in production Compose/PaaS.
- Provide private `/livez` for process health only and `/readyz` for database/schema/service readiness, plus graceful shutdown. Database failure must not turn liveness into a restart loop.
- Keep migrations as a distinct release command/job, not API startup side effect.

The same pinned web image MAY provide a distinct non-public worker command. Deploy it as a separate process/service with only its required runtime role; never start durable inbox/outbox work as unawaited Next request background work.

Next supports Node/Docker self-hosting and recommends a reverse proxy for direct self-hosting. [Next deployment](https://nextjs.org/docs/app/getting-started/deploying), [Next self-hosting](https://nextjs.org/docs/app/guides/self-hosting)

## 8. Deployment shapes

The architecture winner is the shape, not a specific vendor:

```text
Internet
  -> HTTPS / reverse proxy
      -> public Next
          -> protected transport + authenticated Go
              -> PostgreSQL over least-privilege TLS/private path
              -> private R2
      -> non-public auth/integration worker -> PostgreSQL
```

Only Next has public product ingress. “Private” is not enough: Next-to-Go uses restrictive UDS, mTLS, or a provider transport whose confidentiality/integrity properties are documented and tested, plus the delegated JWS.

### Option A — Time-bounded strict-$0 demonstration

Run the production-shaped Compose stack on a controlled machine and expose only the HTTPS reverse proxy/Next endpoint through a temporary tunnel or demonstration network.

Use only when:

- there is no real/persistent user data;
- the owner is present and monitoring;
- the URL is temporary and access can be shut down immediately;
- callback URLs and origin/cookie security are exact;
- the database and Go ports are not exposed;
- the same-host Next-to-Go path uses a restrictive Unix-domain socket where supported or mTLS on the internal network;
- no claim of production availability is made.

This is good for a professor walkthrough, not an open student platform.

### Option B — Small container PaaS environment (first hosted bake-off)

Recommended first hosted evaluation:

- public Next service;
- private/internal-only Go service in the same provider environment/region;
- separate non-public auth/integration worker process;
- managed Supabase PostgreSQL or provider-managed PostgreSQL nearby;
- R2 and transactional email externally;
- production Dockerfiles as the deployment units.

Evaluate Railway first for developer speed, but require a short bake-off rather than encoding a vendor forever. Railway documents private service DNS/networking; Fly provides organization-private 6PN networking; Render provides private services, though plan availability/costs differ. [Railway private networking](https://docs.railway.com/networking/private-networking), [Fly private networking](https://fly.io/docs/networking/private-networking/), [Render private services](https://render.com/docs/private-services)

Provider selection checklist:

- Go can have no public domain/IP/ingress;
- Next and Go share a close region and a channel documented to provide confidentiality/integrity, or Quorum adds mTLS;
- custom domain/TLS and Google callback behavior work;
- long-lived Node/Go services, health checks, logs, secrets, and deploy rollback are supported;
- release migrations run once before compatible application rollout;
- outbound connectivity to database/R2/email works;
- cold starts and sleep behavior meet the demonstration goal;
- current price is accepted by the owner.

Free-tier pricing/sleep/private-network behavior changes frequently. Recheck official provider pages during `A11`; do not make it an architecture invariant.

### Option C — One VM / university server

Run:

```text
reverse proxy/TLS
Next container
Go container reached through restrictive UDS or mTLS on the internal network
auth/integration worker container
PostgreSQL container or university-managed PostgreSQL
backup agent
monitoring/log forwarding
```

Only the reverse proxy publishes ports. Prefer a shared restrictive socket volume if the accepted Node/Go client stack proves UDS support; otherwise use mTLS with rotated service certificates. This shape maximizes portability to university infrastructure and reduces the Next-to-Go hop, but the operator owns OS/container patches, TLS, service certificates/sockets, secrets, monitoring, capacity, database maintenance, backups, restore tests, and incident response.

If PostgreSQL is self-hosted, use off-host encrypted backups and tested restore. A volume is not a backup.

### Option D — Split Vercel plus unrelated Go provider

Not the default. It creates a public/cross-provider Go ingress unless specialized private connectivity is available, adds another failure/latency domain, complicates workload identity, and preserves the currently incomplete deployment seam. Use only after an ADR proves a concrete benefit.

### Option E — Full self-hosted Supabase

Not selected. It is justified only if Quorum deliberately adopts enough Supabase Auth/Storage/Data API/Realtime/Studio capabilities to offset operating the larger stack. Self-hosters own hardening, updates, PostgreSQL, backups, disaster recovery, monitoring, availability, and scale. [Supabase self-hosting responsibilities](https://supabase.com/docs/guides/self-hosting), [Docker self-hosting](https://supabase.com/docs/guides/self-hosting/docker)

## 9. Service authentication and keys

Even on a private Docker/PaaS network, Next signs a short-lived delegated JWS and Go verifies it as specified in `AUTH_V2_CONTRACT.md`. The JWS does not encrypt the response or bind arbitrary HTTP bytes; production therefore also requires restrictive UDS, mTLS, or a provider transport explicitly proven to supply confidentiality and integrity. Public/cross-provider Go ingress additionally requires HTTPS. Ordinary plaintext HTTP on a private network is not accepted by default.

Key rules:

- use an asymmetric algorithm supported by a maintained JOSE library;
- Next receives the private signing key through the secret manager;
- Go receives a versioned public-key set;
- `kid` identifies active/retiring verification keys;
- assertions target 15 seconds and never exceed 60 seconds, and are audience/issuer/type/actor-kind checked;
- roles and permissions never appear in the assertion;
- maintain an overlap rotation window, then remove the old public key after all old assertions expire;
- compromised Next signing key triggers rotation, Next redeploy, assertion rejection, incident review, and session/security assessment.

Platform workload identity may additionally authenticate the service. Properly validated mTLS may satisfy both protected transport and workload identity. Neither replaces the delegated end-user/anonymous context carried in the short-lived assertion.

The assertion is not a custom method/path/body signature. Operation allowlisting, typed input, protected transport, and domain idempotency carry those responsibilities. Measure and document the bounded replay of an already minted assertion after logout; if one-use semantics become required, use an atomic shared `jti` store or accepted platform standard rather than inventing canonicalization.

## 10. Environment and secret inventory

Target categories—not exact final variable names—include:

### Next / Better Auth

- exact public application URL and trusted origins;
- Better Auth secret/key material;
- auth/database connection with `better_auth` privileges only;
- Google client ID/secret and exact callback;
- SMTP host/port/user/password/from address;
- internal Go URL;
- internal JWS signing private key and key ID;
- session idle/absolute/recent-auth settings;
- feature flags that default off and fail closed.

### Go

- app runtime database URL;
- exact allowed internal assertion issuer/audience/type;
- internal JWS public keys;
- R2 credentials, bucket, and signing limits;
- application origin for approved outward links;
- rate/query/deadline limits;
- environment and log/telemetry destination.

### Auth/integration worker

- accepted auth-provider/database configuration needed for session administration;
- least-privilege integration/auth runtime database role;
- queue lease, bounded concurrency, retry/backoff, poison threshold, and reconciliation interval/freshness settings;
- alerts/metrics destination;
- no public listening port other than private health/metrics if the platform requires one.

### Release/migrator

- separate migrator database URL;
- backup/restore credentials;
- deploy provider credentials;
- never shared with normal application runtime.

Remove legacy `NEON_AUTH_*`, `ADMIN_EMAILS`, public R2 URL, browser-visible Go URL, and demo/reset variables at cutover. Production startup refuses their dangerous legacy behavior rather than ignoring ambiguity.

## 11. Google and email environment procedure

For each environment:

1. choose one canonical HTTPS origin;
2. configure Better Auth base URL/trusted origins exactly and derive outward links from configuration, not request `Host`/forwarded headers;
3. obtain the exact generated Google callback path from the pinned framework configuration—do not guess it;
4. register only required local/staging/production callbacks in Google;
5. keep provider secret server-only;
6. test new, returning, cancel, denial, and wrong-return flows;
7. configure a verified email sender domain and SPF/DKIM/DMARC as applicable;
8. verify delivery, link origin, expiry, enumeration resistance, bounce/failure observability;
9. document rotation without recording secret values.

Configure the selected reverse proxy/platform as the only trusted source of forwarded headers. Test direct spoofed `Host`, `Forwarded`, `X-Forwarded-Host`, and `X-Forwarded-Proto`; HTTP-to-HTTPS redirect; secure cookies; and exact callbacks behind the actual proxy/tunnel. Callback/action pages use `Referrer-Policy: no-referrer`, no third-party resources, one-use exchange, and immediate URL cleanup.

Local callback and Mailpit behavior do not prove deployed proxy/origin/cookie behavior; repeat smoke on the selected hostname.

## 12. R2 operations

- Buckets remain private by default.
- Use separate development/test and production buckets or prefixes with least-privilege credentials.
- Production credentials permit only required object operations on the intended bucket/prefix.
- CORS, if needed for signed browser upload/download, names exact origins/methods/headers and does not create public read.
- Keep R2-specific behavior behind an adapter and run real-R2 contract tests; S3 compatibility is not complete. [R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
- Never configure a durable public resume/document domain. Public project marketing assets require a distinct reviewed policy.
- Rotate keys and verify the retired key no longer works.

## 13. Backup and restore

Before real users:

- choose backup owner, frequency, retention, encryption, and off-host location;
- include database, required object metadata, and object-store recovery strategy;
- exclude plaintext secrets from backups or protect them under a separate key process;
- automate backup failure alerts;
- restore into an isolated environment on a schedule;
- recreate/verify cluster-global roles and ownership before schema/data restore;
- run migration integrity and representative application tests after restore;
- reconcile database file metadata with R2 objects and inbox/outbox state;
- before any production restore receives traffic, advance a global/session security epoch where supported or delete/revoke every restored session and require all users to authenticate again;
- record duration, recovery point, recovery time, and discrepancies.

Managed free tiers without automatic backups are acceptable only for disposable demonstration data. Recheck the current managed plan before `G8`.

## 14. Required operational runbooks

Each runbook needs trigger, owner, exact safe steps, verification, rollback, communication, and evidence hygiene.

### Suspend or compromise an account

1. Go transaction changes product state and enqueues session revocation.
2. Verify product denial immediately.
3. Verify worker revokes auth sessions; retry/alert until acknowledged.
4. Review audit/security events without exposing credentials.
5. Rotate affected methods/keys if compromise is suspected.
6. Reactivation requires explicit review and fresh login.

### Auth provider outage

- Existing valid sessions may continue only within their normal checked lifetime and product-state validation.
- New login/linking/recent-auth actions fail safely with a distinct status.
- Do not bypass login or extend absolute sessions manually.
- Reconcile callbacks/events after recovery.

### Database outage

- Session validation and product authorization fail closed.
- Readiness fails; overload/retry budgets prevent request storms.
- No in-memory fallback grants access.
- After recovery, verify migrations, pools, queues, and audit continuity.

### Email outage

- Login methods that do not need email may remain available.
- Verification/reset requests return safe status and queue/retry within bounded policy.
- Do not mark email verified or issue manual reset links in logs/chat.

### Lost/compromised Admin

- The initial one-time bootstrap is permanently consumed/disabled and is never re-enabled for recovery.
- Use the separate controlled break-glass ceremony against a verified internal UUID, with operator identity, reason, MFA/recovery proof, and complete audit. Require two-person approval once a second operator exists.
- Require two-person review when the project gains another operator.
- Revoke compromised sessions/methods, rotate secrets, and audit every grant.
- Never restore Admin through an email allowlist.

### Secret leak

- Identify secret type and scope without copying it into tickets/docs.
- Revoke/rotate, deploy overlapping verification where required, verify old value rejection, search logs/builds/history, assess access, and record incident actions.
- A leaked session/JWS/database/R2/Google/SMTP secret has a different blast radius; use its specific rotation test.

## 15. Release and rollback order

Preferred additive release:

1. verify SHA/digest-pinned Actions, CLIs, images, least GitHub permissions, production Environment approval, and step-scoped/short-lived secrets; remove all `@master`/`@latest` release dependencies;
2. backup and verify current schema/inventory plus cluster-role bootstrap record;
3. prove each predeploy migration supports both the currently serving N-1 image and rollback image. If not, split it into expand -> dual-compatible deploy -> backfill -> switch -> later contract;
4. run additive migrations once under the migrator role/advisory lock in a serialized, non-cancellable release job;
5. deploy Go version compatible with old and new contract/schema but keep new operations closed;
6. deploy Next and the separate auth/integration worker with new contract disabled;
7. run `/livez`, `/readyz`, internal contract, protected-channel, worker, and proxy/canonical-origin checks;
8. enable the repaired vertical slice for dedicated test accounts;
9. run real Google/email/R2 and authorization smoke;
10. enable the approved surface progressively;
11. observe error, denial, queue, query, pool, transport, and latency metrics;
12. remove legacy Neon/demo/admin/public-file paths only after parity/gates;
13. retain immutable compatible image digests, supported schema range, and forward-fix plan through the observation window.

Rollback must not:

- resurrect revoked sessions;
- re-enable public/private-data exposure;
- re-enable demo impersonation or email-admin bootstrap;
- restore a legacy verifier that accepts weaker tokens;
- reverse an irreversible migration without a verified backup;
- deploy an N-1 image outside its recorded schema compatibility range.

When security requires closing a surface, the safe rollback may be “feature unavailable while fixed,” not restoration of the vulnerable implementation.

## 16. Time-sensitive provider review

At `A11`, verify from official sources on that date:

- compute/database price and free-tier limits;
- sleeping/pausing behavior;
- private networking on the selected plan;
- regions and egress;
- backups/PITR and restore capability;
- secret management and deployment rollback;
- Node/Go/PostgreSQL version support;
- email and Google production requirements;
- university privacy/data-residency requirements.

Record the date and links in the deployment ADR. Do not present a 2026 free tier as a permanent architectural guarantee.
