# Auth v2 decision register

**Last updated:** 2026-07-26

This register is append-only in meaning. An accepted decision may be superseded by a new decision entry; do not silently rewrite architecture to match an implementation shortcut.

## Status meanings

- `ACCEPTED`: implementation must follow it.
- `SPIKE_GATED`: preferred, but acceptance criteria must be proven before adoption.
- `PROVISIONAL`: safe default; named owner must approve before the dependent release gate.
- `DEFERRED`: intentionally not part of auth v2.
- `OPEN`: a later task is blocked until resolved.
- `REJECTED`: do not implement without a superseding decision.

## Register

| ID | Status | Decision | Consequence or reopen trigger |
|---|---|---|---|
| D-001 | ACCEPTED | Rewrite the authentication boundary and repair authorization systematically; do not rewrite the whole product domain. | Legacy auth is removed only after vertical-slice parity and cutover gates. |
| D-002 | ACCEPTED | Next.js is the only browser-facing Quorum product origin and acts as a thin BFF. | Browser code never calls Go or PostgreSQL as an authority. OAuth and narrowly scoped object transfers are explicit exceptions. |
| D-003 | ACCEPTED | Retain Go as the dedicated product-domain backend. The project owner is the provisional named Go owner. | Reopen only if long-term ownership disappears or measured topology cost exceeds its isolation benefit. Use a strangler migration, never a big-bang port. |
| D-004 | ACCEPTED | Student and Sponsor registration are public. | The server may create only `STUDENT` or `SPONSOR` self-service grants. Self-selection is not evidence of institutional trust. |
| D-005 | ACCEPTED | Professor and Admin are distinct controlled grants. Professor is invite/approval only; Admin is an audited administrative grant only. | Never derive either role from email, profile input, or OAuth metadata. Exact professor powers must be approved before `G6`. |
| D-006 | ACCEPTED | Sponsor-created projects start as drafts and require server-owned publication approval. | Open sponsor signup must not create an automatic publishing capability. |
| D-007 | ACCEPTED | POC login methods are Google and email/password. Microsoft/Entra is deferred but must remain possible through the external-identity model. | No provider-specific subject may be the product user primary key. |
| D-008 | SPIKE_GATED | Prefer an exact stable Better Auth release in Next, with database-backed opaque sessions. | Task `A03` must prove every acceptance item. Rejecting Better Auth does not complete `A03`; remove the candidate, record rejection, select/test another maintained provider, and keep downstream tasks blocked until one provider passes `G3`. |
| D-009 | ACCEPTED | Use provider-neutral PostgreSQL through ordinary server connections. Managed Supabase PostgreSQL is a deployment candidate, not an application API commitment. | Disable/unexpose Supabase Data APIs; do not use Supabase Auth alongside Better Auth. |
| D-010 | ACCEPTED | Default local dependencies are a pinned PostgreSQL container and Mailpit, not the full Supabase CLI stack. | The full local Supabase stack is introduced only if Quorum deliberately adopts a Supabase platform capability. Docker portability comes from SQL and app images, not `supabase start`. |
| D-011 | ACCEPTED | `apps/api/migrations` remains the one canonical SQL migration history during auth v2. | Better Auth SQL is generated, reviewed, and incorporated there. Do not create parallel `supabase/migrations` or run framework auto-migrations in production. |
| D-012 | ACCEPTED | Keep GraphQL/gqlgen through auth v2, but expose only bounded persisted/allowlisted first-party operations through Next. | Task `A12` later benchmarks GraphQL against typed use-case HTTP. Keeping Go does not require keeping GraphQL. |
| D-013 | ACCEPTED | Cloudflare R2 remains the private object store. | Store object keys, not durable public URLs. A storage-adapter ADR may later replace R2 without changing authorization policy. |
| D-014 | ACCEPTED | Use contract-first, outside-in, test-first vertical slices. | Tests implement agreed policy; they do not invent architecture. Build-then-secure is rejected. |
| D-015 | ACCEPTED | No real users are reported, but a clean cutover is allowed only after environment/user inventory and owner confirmation. Nonempty data requires either a verified backup or an explicit recorded disposable-data loss acceptance. | Destructive reset is prohibited until `A00` evidence and the applicable preservation/loss decision are complete. |
| D-016 | ACCEPTED | No mobile, CLI, or browser-direct external product API is planned. | Optimize the BFF for one web client. Reopen before adding another independently deployed client. |
| D-017 | ACCEPTED | Implicit same-email account linking is disabled. | Explicit linking requires a recent authenticated session and proof of control of both methods. It may be deferred from the POC UI. |
| D-018 | ACCEPTED | Require verified email before messaging, uploads, applications, invitations, or project-publication requests. | Lowering the gate requires a superseding decision plus threat and test updates. |
| D-019 | ACCEPTED | Ordinary sessions use a 24-hour idle limit and 7-day absolute limit; privileged actions require authentication within 10 minutes. No remember-me in POC. | `A03` must prove enforceability. Adjust through measured UX/security review, never by silently changing constants. |
| D-020 | ACCEPTED | Admin MFA is required before accepting real users; general-user MFA is deferred. | `A07M` must implement enrollment, step-up, factor lifecycle/recovery, revocation, and fail-closed behavior. If the accepted provider cannot support it safely, privileged release is blocked. |
| D-021 | ACCEPTED | Anonymous visitors may see only sanitized summaries of approved, published projects and explicitly public sponsor information. | Student profiles, teams, applications, messages, answers, reviews, offers, files, and drafts require an authenticated authorized viewer. |
| D-022 | ACCEPTED | Build portable production Docker images and expose only Next. Go and PostgreSQL remain on private/host-internal networking; Next-to-Go uses both service/delegated authentication and a confidential, integrity-protected transport. | Exact compute vendor is replaceable. Use a restrictive Unix socket, mTLS, or a provider-private transport whose properties are proven. Public/cross-provider Go ingress requires HTTPS plus JWS and is not the default. |
| D-023 | OPEN | Choose the first public-demo host and database tier after a small deployment bake-off. | Blocks deployed demo release, not local implementation. Evaluate one small PaaS environment with private services first; a strict-$0 demo may use a time-bounded local deployment/tunnel with no real data. |
| D-024 | OPEN | Define exact Professor versus Admin actions and the initial Admin bootstrap identity. | Blocks privileged-policy implementation and `G6`, not auth framework work. |
| D-025 | OPEN | Select production transactional email/SMTP and sender domain. | Mailpit is sufficient locally; a real email/password demo and public release require delivered-message evidence. |
| D-026 | OPEN | Set data retention/deletion periods and backup owner/location. | Blocks accepting meaningful real-user files/messages, not the authentication spike. |
| D-027 | ACCEPTED | Local/CI baseline is PostgreSQL 17, Node 22, Go 1.25; `A02` pins exact supported patch versions and image digests after compatibility checks. | Change the major only through an A02 sub-decision showing extension, driver, framework, and intended managed-host compatibility. Production may use another supported PostgreSQL major only after the portability suite passes. |
| D-028 | ACCEPTED | The internal delegated subject is the stable user ID issued by the accepted auth deployment, initially the Better Auth user ID—not a Google/Microsoft/provider-account subject. | Provider accounts/subjects remain auth-provider-owned links. Multiple methods linked to one auth user resolve one Quorum user. |
| D-029 | ACCEPTED | Auth-to-product security changes need a transactional outbox when the provider supports the same transaction; otherwise use durable best-effort events plus versioned periodic reconciliation and freshness gates. | Framework hooks alone are not evidence of durable delivery. Dropped/reordered/duplicate/poison events and reconciliation outages must be tested. |
| D-030 | ACCEPTED | Durable inbox/outbox processing runs in a separately deployed non-public worker process, not fire-and-forget request work. | The worker may reuse the web image but has a distinct command, least-privilege role, leases, bounded retries, poison handling, health, and backlog metrics. |
| D-031 | ACCEPTED | For the single-factor general-user POC, require at least 15 Unicode code points, accept at least 64 (target maximum 128), allow Unicode/space, password managers, and paste, omit composition rules, never silently truncate, and screen common/breached values through a maintained privacy-preserving mechanism. | `A03` must prove the accepted provider can enforce the policy and define consistent normalization behavior without custom credential handling. |
| D-032 | ACCEPTED | The owner classifies all currently inventoried Neon rows as disposable demo/test data and accepts their total loss; no backup is required for this legacy dataset. | Preserve Neon untouched during implementation. Immediately before destructive cutover, repeat aggregate counts, verify no public deployment/new real users, record explicit cutover approval, revoke/invalidate all legacy sessions, then delete only the named legacy environment. |
| D-033 | ACCEPTED | On 2026-07-26 the project owner approved G2 from the complete service-backed local Docker, migration/reset/role, Mailpit, Vitest, Playwright, Docker-context, and negative-control evidence even though GitHub MCP confirmed no PR-triggered Ubuntu run exists. | This is a sequencing exception, not removal of the test: the exact pinned Ubuntu workflow must be green before G3/framework acceptance. A03 may begin, but cannot complete and no downstream A04/A05 work may start without that evidence. Reopen immediately if local/Ubuntu behavior diverges. |
| D-034 | OPEN | Resolve the password-length enforcement unit after exact stable Better Auth 1.6.25 and Ory Kratos 26.2.0 both failed the accepted 15-Unicode-code-point boundary. | The project owner must either retain D-031/PASS-02 and authorize a longer provider/upstream-fix search, or supersede them with a precisely tested alternative. Quorum will not silently substitute UTF-16 code units/UTF-8 bytes or add custom plaintext credential validation. Blocks A03/G3 and every downstream auth task. |

## Rejected options

| ID | Status | Option | Reason |
|---|---|---|---|
| R-001 | REJECTED | Continue patching the beta Neon Auth integration | Current callback/session seam is broken and the surrounding authorization boundary needs redesign. |
| R-002 | REJECTED | Rewrite Go into raw Express | It removes no service boundary and adds an intentionally unopinionated framework migration without product value. |
| R-003 | REJECTED | Rewrite Go into Spring Boot now | Spring is valid for a Java-owned system, but a simultaneous language/domain/auth rewrite is unjustified. |
| R-004 | REJECTED | Browser-direct Supabase Data API as the product policy boundary | It would move policy into RLS/Data API and contradict the selected Go authorization owner. |
| R-005 | REJECTED | Run Better Auth and Supabase Auth together | Two identity/session authorities create ambiguous lifecycle, linking, and revocation behavior. |
| R-006 | REJECTED | Full local Supabase merely for PostgreSQL | It runs unused services, is development-only, and creates migration/operations confusion without improving portability. |
| R-007 | REJECTED | `better-auth@1.6.25` as the A03 provider | A service-backed negative test proved that a password containing 14 Unicode code points but 15 UTF-16 code units is accepted and persisted under `minPasswordLength: 15`. D-031/PASS-02 require at least 15 Unicode code points and forbid a Quorum plaintext-validation workaround. The candidate also returned the reusable database session token in sign-in JSON before BFF projection and stores that directly reusable token in plaintext, reinforcing that acceptance cannot be inferred from its otherwise successful schema/session tests. |
| R-008 | REJECTED | `oryd/kratos:v26.2.0@sha256:2a13bb8d362c7a7ae33bd7c0f5168aee46921f15c916a06346db91c06dc76643` as the A03 provider | Both automated and non-development live controls with `min_password_length: 15` rejected 14 ASCII code points, accepted 14 code points containing one supplementary Unicode character, and accepted the 15-code-point control. This proves encoded-length rather than Unicode-code-point enforcement. Candidate container/configuration artifacts were removed. |

## How to change a decision

Add a new entry containing:

1. context and evidence;
2. the superseded decision ID;
3. alternatives considered;
4. migration and rollback consequences;
5. invariant/test/task IDs affected;
6. owner and approval date.

Then update the contract, implementation plan, verification matrix, operations guide, and status in the same reviewed change.
