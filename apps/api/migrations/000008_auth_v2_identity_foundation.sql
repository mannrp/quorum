DO $$
DECLARE
  required_role text;
BEGIN
  FOREACH required_role IN ARRAY ARRAY[
    'quorum_auth_owner',
    'quorum_app_owner',
    'quorum_integration_owner',
    'quorum_audit_owner',
    'quorum_auth_runtime',
    'quorum_app_runtime'
  ]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = required_role) THEN
      RAISE EXCEPTION 'required database role % is missing; run bootstrap-roles first', required_role;
    END IF;
  END LOOP;
END
$$;

CREATE SCHEMA better_auth AUTHORIZATION quorum_auth_owner;
CREATE SCHEMA app AUTHORIZATION quorum_app_owner;
CREATE SCHEMA integration AUTHORIZATION quorum_integration_owner;
CREATE SCHEMA audit AUTHORIZATION quorum_audit_owner;

SET LOCAL ROLE quorum_auth_owner;
REVOKE ALL ON SCHEMA better_auth FROM PUBLIC;
RESET ROLE;
SET LOCAL ROLE quorum_app_owner;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
RESET ROLE;
SET LOCAL ROLE quorum_integration_owner;
REVOKE ALL ON SCHEMA integration FROM PUBLIC;
RESET ROLE;
SET LOCAL ROLE quorum_audit_owner;
REVOKE ALL ON SCHEMA audit FROM PUBLIC;
RESET ROLE;

SET LOCAL ROLE quorum_auth_owner;
SET LOCAL search_path = better_auth, pg_catalog, pg_temp;

DO $$
BEGIN
  IF current_schema() <> 'better_auth' THEN
    RAISE EXCEPTION 'Better Auth schema isolation failed';
  END IF;
END
$$;

CREATE TABLE "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL,
  "image" text,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "twoFactorEnabled" boolean
);

CREATE TABLE "session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "absoluteExpiresAt" timestamptz NOT NULL,
  "assurance" text NOT NULL,
  "authenticatedAt" timestamptz NOT NULL,
  "authenticationMethods" text NOT NULL,
  "lastSeenAt" timestamptz NOT NULL
);

CREATE TABLE "account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "twoFactor" (
  "id" text PRIMARY KEY,
  "secret" text NOT NULL,
  "backupCodes" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "verified" boolean,
  "failedVerificationCount" integer,
  "lockedUntil" timestamptz
);

CREATE TABLE "rateLimit" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "count" integer NOT NULL,
  "lastRequest" bigint NOT NULL
);

CREATE INDEX "session_userId_idx" ON "session" ("userId");
CREATE INDEX "account_userId_idx" ON "account" ("userId");
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor" ("secret");
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor" ("userId");

GRANT USAGE ON SCHEMA better_auth TO quorum_auth_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA better_auth TO quorum_auth_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA better_auth
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO quorum_auth_runtime;

RESET ROLE;
GRANT REFERENCES ON public.users TO quorum_app_owner, quorum_audit_owner;
SET LOCAL ROLE quorum_app_owner;
SET LOCAL search_path = app, public, pg_catalog, pg_temp;

CREATE TABLE identity_realms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_key text NOT NULL UNIQUE,
  auth_system text NOT NULL CHECK (auth_system IN ('BETTER_AUTH')),
  issuer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (realm_key = btrim(realm_key) AND realm_key <> ''),
  CHECK (issuer IS NULL OR (issuer = btrim(issuer) AND issuer <> ''))
);

CREATE TABLE user_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  realm_id uuid NOT NULL REFERENCES identity_realms (id) ON DELETE RESTRICT,
  identity_subject text NOT NULL,
  verified_email text,
  email_verified_at timestamptz,
  auth_version bigint NOT NULL DEFAULT 0 CHECK (auth_version >= 0),
  sync_status text NOT NULL DEFAULT 'CURRENT'
    CHECK (sync_status IN ('CURRENT', 'STALE', 'RECONCILE_REQUIRED', 'DISABLED')),
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  last_synced_at timestamptz,
  reconcile_after timestamptz,
  unlinked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (realm_id, identity_subject),
  UNIQUE (realm_id, user_id),
  CHECK (identity_subject = btrim(identity_subject) AND identity_subject <> ''),
  CHECK ((verified_email IS NULL) = (email_verified_at IS NULL))
);

CREATE TABLE account_states (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'DELETED')),
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  session_revocation_version bigint NOT NULL DEFAULT 0 CHECK (session_revocation_version >= 0),
  suspended_at timestamptz,
  deactivated_at timestamptz,
  deleted_at timestamptz,
  last_reconciled_at timestamptz,
  reconcile_after timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'SUSPENDED') = (suspended_at IS NOT NULL)),
  CHECK ((status = 'DEACTIVATED') = (deactivated_at IS NOT NULL)),
  CHECK ((status = 'DELETED') = (deleted_at IS NOT NULL))
);

CREATE TABLE role_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('STUDENT', 'SPONSOR', 'PROFESSOR', 'ADMIN')),
  source text NOT NULL CHECK (source IN ('SELF_SERVICE', 'INVITATION', 'ADMIN_GRANT', 'BOOTSTRAP')),
  granted_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);

CREATE UNIQUE INDEX role_grants_one_active_role
  ON role_grants (user_id, role)
  WHERE revoked_at IS NULL;

CREATE TABLE role_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('PROFESSOR', 'ADMIN')),
  token_digest bytea NOT NULL UNIQUE CHECK (octet_length(token_digest) >= 32),
  email_digest bytea CHECK (email_digest IS NULL OR octet_length(email_digest) >= 32),
  issued_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  accepted_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'SUPERSEDED', 'EXPIRED')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK ((status = 'ACCEPTED') = (accepted_at IS NOT NULL AND accepted_by IS NOT NULL)),
  CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL))
);

CREATE INDEX user_identities_user_id_idx ON user_identities (user_id);
CREATE INDEX user_identities_sync_idx ON user_identities (sync_status, reconcile_after);
CREATE INDEX account_states_status_idx ON account_states (status, reconcile_after);
CREATE INDEX role_grants_user_active_idx ON role_grants (user_id, revoked_at);
CREATE INDEX role_invitations_status_expiry_idx ON role_invitations (status, expires_at);

GRANT USAGE ON SCHEMA app TO quorum_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO quorum_app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO quorum_app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO quorum_app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA app
  GRANT USAGE, SELECT ON SEQUENCES TO quorum_app_runtime;
GRANT USAGE ON SCHEMA app TO quorum_integration_owner;
GRANT REFERENCES ON identity_realms TO quorum_integration_owner;

RESET ROLE;
SET LOCAL ROLE quorum_integration_owner;
SET LOCAL search_path = integration, app, public, pg_catalog, pg_temp;

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version >= 0),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'POISON')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claimed_by text,
  processed_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (aggregate_type = btrim(aggregate_type) AND aggregate_type <> ''),
  CHECK (aggregate_id = btrim(aggregate_id) AND aggregate_id <> ''),
  CHECK (event_type = btrim(event_type) AND event_type <> ''),
  CHECK (idempotency_key = btrim(idempotency_key) AND idempotency_key <> '')
);

CREATE TABLE inbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  external_event_id text NOT NULL,
  payload_sha256 bytea NOT NULL CHECK (octet_length(payload_sha256) = 32),
  status text NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'POISON')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claimed_by text,
  processed_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_event_id),
  CHECK (source = btrim(source) AND source <> ''),
  CHECK (external_event_id = btrim(external_event_id) AND external_event_id <> '')
);

CREATE TABLE reconciliation_state (
  realm_id uuid NOT NULL REFERENCES app.identity_realms (id) ON DELETE CASCADE,
  identity_subject text NOT NULL,
  expected_version bigint NOT NULL DEFAULT 0 CHECK (expected_version >= 0),
  observed_version bigint NOT NULL DEFAULT 0 CHECK (observed_version >= 0),
  status text NOT NULL DEFAULT 'CURRENT'
    CHECK (status IN ('CURRENT', 'STALE', 'PROCESSING', 'FAILED')),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  next_attempt_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  last_error_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (realm_id, identity_subject),
  CHECK (identity_subject = btrim(identity_subject) AND identity_subject <> '')
);

CREATE INDEX outbox_events_claim_idx ON outbox_events (status, available_at, created_at);
CREATE INDEX inbox_events_claim_idx ON inbox_events (status, received_at);
CREATE INDEX reconciliation_state_due_idx ON reconciliation_state (status, next_attempt_at);

GRANT USAGE ON SCHEMA integration TO quorum_app_runtime, quorum_auth_runtime;
GRANT SELECT, INSERT ON outbox_events TO quorum_app_runtime, quorum_auth_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA integration TO quorum_app_runtime, quorum_auth_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA integration REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA integration REVOKE ALL ON SEQUENCES FROM PUBLIC;

RESET ROLE;
SET LOCAL ROLE quorum_audit_owner;
SET LOCAL search_path = audit, app, public, pg_catalog, pg_temp;

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_kind text NOT NULL CHECK (actor_kind IN ('USER', 'SYSTEM', 'WORKER', 'OPERATOR', 'ANONYMOUS')),
  actor_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  source_event_id uuid,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((actor_kind = 'USER') = (actor_user_id IS NOT NULL)),
  CHECK (action = btrim(action) AND action <> ''),
  CHECK (target_type = btrim(target_type) AND target_type <> '')
);

CREATE UNIQUE INDEX audit_events_source_event_idx
  ON events (source_event_id)
  WHERE source_event_id IS NOT NULL;
CREATE INDEX audit_events_target_idx ON events (target_type, target_id, occurred_at DESC);
CREATE INDEX audit_events_actor_idx ON events (actor_user_id, occurred_at DESC);

GRANT USAGE ON SCHEMA audit TO quorum_app_runtime, quorum_auth_runtime;
GRANT INSERT ON events TO quorum_app_runtime, quorum_auth_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA audit TO quorum_app_runtime, quorum_auth_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit REVOKE ALL ON SEQUENCES FROM PUBLIC;

RESET ROLE;
SET LOCAL ROLE quorum_auth_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA better_auth FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA better_auth FROM PUBLIC;

RESET ROLE;
SET LOCAL ROLE quorum_app_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM PUBLIC;

RESET ROLE;
SET LOCAL ROLE quorum_integration_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA integration FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA integration FROM PUBLIC;

RESET ROLE;
SET LOCAL ROLE quorum_audit_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA audit FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA audit FROM PUBLIC;

RESET ROLE;
SET LOCAL search_path = public, pg_catalog, pg_temp;
