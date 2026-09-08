# Auth V2 contract

This file contains durable product and security rules. It is intentionally independent of task numbers and implementation history.

## Goal

Quorum uses this boundary:

```text
Browser -> public Next.js -> protected authenticated channel -> private Go -> PostgreSQL / private object storage
```

Next owns browser authentication, sessions, CSRF/origin checks, and response composition. Go owns product identity, account state, roles, authorization, workflows, and application writes. PostgreSQL is the authority for current product state.

## Authentication and sessions

- Use a maintained stable Better Auth release with PostgreSQL. Pin the exact version in the manifest and lockfile.
- The only reusable browser credential is an opaque, `Secure`, `HttpOnly`, host-only cookie with an explicit SameSite policy.
- Do not return session tokens, OAuth credentials, password material, verification/reset values, or internal assertions to browser JavaScript.
- Sessions are database-backed, individually listable and revocable. Login and security-sensitive account changes rotate or revoke affected sessions.
- Default limits are 24 hours idle and 7 days absolute. Privileged actions require authentication within 10 minutes.
- Authentication time, method, and assurance come from real authentication events; refresh does not manufacture recent authentication.
- State-changing routes enforce the configured canonical origin, appropriate Fetch Metadata/CSRF checks, JSON content type, body limits, and an authenticated session.
- Production email/password signup requires email verification. A nonproduction environment may explicitly bypass it for local/demo work; production fails closed if that bypass is requested.
- Verification and recovery values are random, purpose-bound, short-lived, one-use, stored safely, and never logged. Related pages use `Referrer-Policy: no-referrer` and no third-party resources.
- Password handling, OAuth state/PKCE/nonce, session tokens, and recovery cryptography come from maintained libraries, not Quorum code.

## Identity and account state

- An authenticated provider user is identified by `(identity realm, stable Better Auth user ID)`, never by editable email or provider display metadata.
- A binding resolves to exactly one Quorum user. Unknown, unlinked, stale, ambiguous, suspended, deactivated, or deleted identities fail closed.
- Provisioning is idempotent for the accepted realm/user pair. It does not silently merge accounts with the same email.
- Linking and unlinking are explicit, recent-authenticated operations with collision checks and audit records.
- Verified email is evidence for workflows that explicitly need it; it is never a product identity key or authorization source.

## Authorization

- Go constructs the principal from current database state on each protected request. Browser or assertion hints never override it.
- Student and Sponsor may be self-selected only through the approved enrollment flow.
- Professor and Admin require explicit grants. Editable profiles, environment email lists, identity-provider metadata, and self-assertion never grant them.
- Admin functionality remains unavailable until MFA enrollment, challenge, recovery, and recent-auth enforcement are implemented and tested.
- Authorization is deny-by-default and checked at the use-case/resource boundary, including nested fields and file access.
- Do not build policy for dormant features. Add an authorization table and tests when an operation is exposed.

## Next-to-Go boundary

- Next signs a short-lived Ed25519 JWS; Go verifies it with maintained JOSE libraries and a bounded versioned key set.
- The protected header has exact algorithm, key ID, and type. Go validates signature, issuer, audience, issued/not-before/expiry times, maximum 60-second lifetime, and actor-specific claims.
- Authenticated assertions contain: contract version, issuer, audience, timestamps, JTI, correlation ID, actor kind, identity realm, stable Better Auth user ID, authenticated-at, authentication methods, assurance, and device handle.
- Anonymous assertions omit all authenticated identity claims.
- Assertions never contain roles, permissions, email authority, approval, profile-completion authority, ownership, or resource capabilities.
- Replay is bounded by the short assertion lifetime. Do not claim logout retroactively erases an already minted assertion.
- The assertion authenticates delegated context; it does not encrypt or integrity-protect the HTTP body. Production also requires a restrictive Unix-domain socket, mTLS, or a reviewed provider transport with confidentiality and integrity. Plain private-network HTTP is insufficient.
- Requests carry a deadline and correlation ID. Cancellation propagates. Automatic retries are limited to explicitly idempotent operations.

## Browser API

- The browser calls same-origin Next routes using registered operation IDs and typed inputs.
- Next maps each ID to one reviewed Go use case. It never forwards arbitrary GraphQL documents, methods, paths, URLs, identity fields, or headers.
- Add operations only when the product uses them. Legacy operations remain unreachable through Auth V2 until migrated and tested.
- Responses are explicit projections, use stable nonleaking errors, and apply `private, no-store` where viewer/session state is involved.

### First operation: `ViewerBootstrapV1`

It accepts no browser-provided identity or authorization input and returns only:

```text
viewer:
  productUserId: UUID
  accountState: ACTIVE | SUSPENDED | DEACTIVATED | DELETED
  onboardingState: NOT_STARTED | IN_PROGRESS | COMPLETE
  username: String?
  displayName: String?
  selfServiceRoles: [STUDENT | SPONSOR]
```

`selfServiceRoles` is a navigation hint, not authorization evidence. The response excludes provider/auth IDs, email, verification state, session values, Professor/Admin grants, private profile fields, and file URLs.

## Database and services

- Better Auth tables live only in `better_auth`. Product identity, account state, grants, integration state, and audit data use their canonical schemas.
- Runtime roles are least-privilege and cannot own schema, run DDL, or cross-read credentials/policy data.
- All schema changes use additive canonical migrations in `apps/api/migrations`, applied by the migration role before compatible application rollout.
- Cross-boundary lifecycle work is transactional or uses a durable idempotent outbox/reconciliation path when such a workflow is actually introduced. Do not prebuild a generic worker.
- Only Next has public product ingress. Go, PostgreSQL, worker endpoints, and object storage remain private.

## Files and privacy

- Object storage is private. Store object keys, not durable public URLs.
- Go authorizes each upload/download and issues short-lived, narrowly scoped access only after checking current relationships and resource state.
- Logs and evidence contain identifiers only when necessary and never contain secrets, reusable credentials, private documents, raw production records, or sensitive URL values.

## Cutover rule

Legacy Neon authentication, arbitrary browser GraphQL forwarding, demo identity headers, `ADMIN_EMAILS`, public file URLs, and browser-visible backend origins must be removed before Auth V2 is considered complete. A safe rollback may disable a feature; it must not restore a weaker authentication or authorization path.