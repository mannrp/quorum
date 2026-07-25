# Quorum implementation-agent instructions

These instructions apply to the entire repository. They are written for human contributors and coding agents.

## Mandatory reading order

Before changing authentication, sessions, users, roles, authorization, GraphQL exposure, files, database privileges, Docker, CI, or deployment, read these files in order:

1. `docs/auth/STATUS.md`
2. `docs/auth/DECISIONS.md`
3. `docs/auth/AUTH_V2_CONTRACT.md`
4. The task card in `docs/auth/IMPLEMENTATION.md`
5. The relevant rows in `docs/auth/VERIFICATION.md`
6. `docs/auth/OPERATIONS.md` for infrastructure or operational work

`AUTH_ARCHITECTURE_SECURITY_AUDIT.md` is supporting evidence and rationale. It is not the day-to-day task queue. Files under `.planning/` are historical and ignored by git; they do not override the auth-v2 documents.

If two documents conflict, stop only the affected work and add a `DECISION-NEEDED` entry to `docs/auth/STATUS.md`. Do not choose the weaker security rule.

## Source-of-truth precedence

From strongest to weakest:

1. Current user instruction that is within the accepted security/policy contract
2. This `AGENTS.md`
3. Accepted decisions in `docs/auth/DECISIONS.md`
4. Invariants in `docs/auth/AUTH_V2_CONTRACT.md`
5. Approved authorization rows in that contract
6. Task and gate definitions in `docs/auth/IMPLEMENTATION.md`
7. Verification requirements in `docs/auth/VERIFICATION.md`
8. Operational procedures in `docs/auth/OPERATIONS.md`
9. The dated audit
10. Existing implementation and historical planning files

Existing code is evidence of current behavior, not proof that the behavior is desired or secure. A user request that explicitly changes product/security policy may supersede an accepted decision only through a recorded decision plus contract, verification, migration, and owner-approval updates. A task-level request such as “temporarily expose Go” or “skip this test” does not silently override an invariant; pause only the affected work and request a superseding decision.

## Work protocol

1. Work on exactly one `ready` task ID unless the task explicitly allows a grouped change.
2. Confirm every dependency is `done` in `docs/auth/STATUS.md`.
3. Read the task's in-scope, out-of-scope, invariants, risk IDs, tests, and rollback notes.
4. Mark the task `in_progress`, name the implementer and reviewer, and record the branch before any scoped repository or external-system mutation.
5. Add or identify a failing test first. The failure must be for the intended missing behavior.
6. Make the smallest dependency-respecting change.
7. Run the focused tests and every required gate command. Required tests must fail—not skip—when infrastructure is unavailable.
8. Record exact commands and concise results in `docs/auth/STATUS.md`. Never record secrets, tokens, cookies, OAuth codes, personal documents, or raw production data.
9. Move the task to `in_review`. The designated reviewer—not the implementer—marks the task `done`. Only the named project owner may mark a security phase gate passed.
10. After review, append a dated status-log entry. Never rewrite status history to hide a correction.

## Non-negotiable prohibitions

- Do not weaken an invariant to make a test pass.
- Do not implement authentication, OAuth, password hashing, session-token generation, or recovery cryptography from scratch.
- Do not combine the auth rewrite, domain rewrite, and GraphQL removal in one work package.
- Do not trust browser-provided identity, email, role, account state, ownership, approval, or capability data.
- Do not authorize by editable email, `ADMIN_EMAILS`, profile role, or identity-provider display metadata.
- Do not expose reusable credentials in JSON, HTML, URLs, browser-readable storage, logs, analytics, or screenshots.
- Do not let browser code call Go, PostgreSQL, Supabase Data APIs, or object storage as the product-policy authority.
- Do not forward arbitrary browser GraphQL documents to Go.
- Do not put Better Auth tables in Supabase's reserved `auth` schema. The target schema is `better_auth`.
- Do not add a demo/test bypass, impersonation header, silent fallback, placeholder secret, or production fail-open behavior.
- Do not make a security-relevant test conditional on optional CI secrets. Use deterministic local/CI dependencies or fail the gate.
- Do not create a second migration history. Canonical Quorum SQL migrations remain in `apps/api/migrations` unless an accepted ADR replaces that system.
- Do not apply schema changes manually through a hosted database dashboard.
- Do not expose Go or PostgreSQL publicly merely because a host makes that convenient.
- Do not make files public by URL. Store object keys and authorize each short-lived download.
- Do not commit `.env` files, credentials, private keys, dumps, test mail containing secrets, or personal data.
- Do not modify `package-lock.json` incidentally. Before `A02`, the owner must preserve/commit or explicitly baseline the current user-owned diff. A dependency task must show focused manifest plus lockfile changes and must not normalize unrelated lock entries.
- Do not use destructive database reset/cutover steps until inventory, backup, and the no-real-users prerequisite are recorded.
- Do not leave an unowned `TODO`. Use a task ID, decision ID, owner, and phase.

## Architecture boundary

The selected target is:

```text
Browser -> public Next.js BFF -> authenticated confidential/integrity-protected channel -> private Go service -> PostgreSQL / private R2
```

Next owns browser authentication, opaque sessions, CSRF/origin enforcement, SSR, and UI-shaped composition. Go owns the authoritative product principal, authorization, workflows, transactions, and application writes. A private network reduces exposure but does not replace service authentication or protected transport. Production uses a restrictive Unix-domain socket, mTLS, or a provider transport explicitly proven to supply confidentiality and integrity; public/cross-provider ingress additionally requires HTTPS.

## Repository care

- Preserve unrelated user changes and dirty files.
- Use additive database migrations. Never edit an already-applied migration without an explicit migration-repair decision.
- Keep transports thin. Domain packages must not import Next, HTTP, gqlgen, Better Auth, or generated sqlc row types.
- Regenerate generated code through documented commands; do not hand-edit generated files.
- Prefer server-only environment variables. A value prefixed `NEXT_PUBLIC_` is browser-visible by design.
- Before introducing Docker image builds, add and verify a root `.dockerignore`; local ignored env files exist on disk and must not enter build contexts.

## Baseline verification

Run the commands required by the active task. The current general baseline is:

```sh
npm run lint
npm run typecheck
npm run build
cd apps/api && go test ./...
```

Auth-v2 tasks will add deterministic integration and browser commands. Do not claim those gates until the scripts exist and run successfully.
