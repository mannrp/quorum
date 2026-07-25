# Quorum auth v2 living documentation

**State:** contract approved; deterministic implementation harness in progress  
**Owner:** project owner  
**Last updated:** 2026-07-24

This directory is the implementation control plane for the Quorum authentication and authorization revision. It converts the dated audit into small normative documents that a contributor can execute without inventing policy.

## Read in this order

1. [`STATUS.md`](STATUS.md) — current state, next task, blockers, and evidence
2. [`DECISIONS.md`](DECISIONS.md) — accepted, provisional, deferred, and open decisions
3. [`AUTH_V2_CONTRACT.md`](AUTH_V2_CONTRACT.md) — architecture, security invariants, flows, and authorization rules
4. [`IMPLEMENTATION.md`](IMPLEMENTATION.md) — dependency graph, task cards, gates, and rollback expectations
5. [`VERIFICATION.md`](VERIFICATION.md) — tests and evidence required to prove each invariant
6. [`OPERATIONS.md`](OPERATIONS.md) — local Docker dependencies, migrations, deployment shapes, backups, and incidents

The full outsider review remains at [`../../AUTH_ARCHITECTURE_SECURITY_AUDIT.md`](../../AUTH_ARCHITECTURE_SECURITY_AUDIT.md). It explains why these rules exist and contains the complete risk register.

## Current and target systems

The repository currently uses a beta Neon Auth wrapper, a same-origin Next GraphQL proxy, Go/gqlgen, PostgreSQL, and R2. The current system remains legacy until the cutover gate passes.

The approved target is:

```text
Browser
  -> Next.js BFF and Better Auth candidate
      -> service-authenticated, protected channel
          -> private Go domain service
          -> provider-neutral PostgreSQL
          -> private Cloudflare R2
```

Better Auth is spike-gated, not yet accepted. GraphQL stays during auth v2 and is benchmarked against typed use-case HTTP only after security and query-shape work is complete.

## How to start implementation

The next executable task is always named at the top of [`STATUS.md`](STATUS.md). `IMPLEMENTATION.md` contains the immutable task definitions and dependency graph; `STATUS.md` is the live board and evidence log.

Only work whose dependencies are `done` may start. Every change cites:

- one task ID;
- the invariant IDs it implements;
- relevant audit risk IDs;
- the exact tests and results that prove completion.

## Planned milestones

These are the reviewable outcomes worth committing and demonstrating. Task IDs may produce intermediate commits, but a milestone is complete only when its named gate is marked `done` in `STATUS.md`.

| Milestone | Gate | Outcome |
|---|---|---|
| M0 — Contain and agree | G0 + G1 | Inventory the legacy system, contain accidental deployment, approve policy, and freeze the Auth V2 contract. |
| M1 — Reproducible foundation | G2 | One-command PostgreSQL/Mailpit, safe migrations/reset, deterministic integration/browser tests, and CI that fails instead of skipping. |
| M2 — Prove the auth provider | G3 | Accept or reject an exact maintained auth provider using security, schema, session, OAuth, password, and upgrade evidence. |
| M3 — Complete Google identity | G4 | Google login, idempotent product provisioning, private Next-to-Go identity, and the narrow viewer operation work end to end. |
| M4 — Complete account security | G5 + G5A | Email/password, verification/recovery, session/device lifecycle, privileged MFA, and recovery are proven. |
| M5 — Repair authorization | G6 | Roles, invitations, resource relationships, response projections, and persisted GraphQL operations are deny-by-default and tested. |
| M6 — Protect private data | G7 | Private file upload/download, scanning policy, quotas, signing, replacement, and cleanup are proven. |
| M7 — Release safely | G8 | Production topology, secrets, email, backups, observability, load evidence, cutover, and rollback are operationally ready. |
| M8 — Simplify by evidence | G9 | Benchmark GraphQL against typed HTTP after stabilization and keep or replace it based on measured product cost. |

Detailed acceptance criteria for every gate are in [`IMPLEMENTATION.md`](IMPLEMENTATION.md); permanent test IDs are in [`VERIFICATION.md`](VERIFICATION.md).

## Terms

- **Authentication:** proving an identity or authentication event.
- **Session:** the revocable continuity between authentication and later requests.
- **Authorization:** deciding whether a principal may perform an action on a resource in its current state.
- **BFF:** backend-for-frontend; Quorum's Next server boundary for its web UI.
- **Principal:** the authoritative Go-side product actor resolved from current database state.
- **Identity realm:** a versioned namespace for external subjects, such as `quorum:better-auth:prod:v1`.
- **Workload identity:** proof that a request came from the Next service; it is distinct from the end-user identity.
- **Phase gate:** an owner-approved evidence checkpoint, not merely a completed coding task.
