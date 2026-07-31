-- Reviewed A03 acceptance fixture for exact better-auth@1.6.25.
-- This is not a second migration history and must not be deployed. The accepted
-- schema will be converted into an additive apps/api/migrations change in A04.
CREATE SCHEMA better_auth AUTHORIZATION quorum_auth_owner;
SET LOCAL ROLE quorum_auth_owner;
SET LOCAL search_path = better_auth, pg_catalog, pg_temp;

DO $$
BEGIN
  IF current_schema() <> 'better_auth' THEN
    RAISE EXCEPTION 'Better Auth schema isolation failed';
  END IF;
END
$$;

CREATE TABLE "user" ("id" text NOT NULL PRIMARY KEY, "name" text NOT NULL, "email" text NOT NULL UNIQUE, "emailVerified" boolean NOT NULL, "image" text, "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL, "twoFactorEnabled" boolean);
CREATE TABLE "session" ("id" text NOT NULL PRIMARY KEY, "expiresAt" timestamptz NOT NULL, "token" text NOT NULL UNIQUE, "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" timestamptz NOT NULL, "ipAddress" text, "userAgent" text, "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE, "absoluteExpiresAt" timestamptz NOT NULL, "assurance" text NOT NULL, "authenticatedAt" timestamptz NOT NULL, "authenticationMethods" text NOT NULL, "lastSeenAt" timestamptz NOT NULL);
CREATE TABLE "account" ("id" text NOT NULL PRIMARY KEY, "accountId" text NOT NULL, "providerId" text NOT NULL, "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" timestamptz NOT NULL);
CREATE TABLE "verification" ("id" text NOT NULL PRIMARY KEY, "identifier" text NOT NULL, "value" text NOT NULL, "expiresAt" timestamptz NOT NULL, "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL);
CREATE TABLE "twoFactor" ("id" text NOT NULL PRIMARY KEY, "secret" text NOT NULL, "backupCodes" text NOT NULL, "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE, "verified" boolean, "failedVerificationCount" integer, "lockedUntil" timestamptz);
CREATE TABLE "rateLimit" ("id" text NOT NULL PRIMARY KEY, "key" text NOT NULL UNIQUE, "count" integer NOT NULL, "lastRequest" bigint NOT NULL);
CREATE INDEX "session_userId_idx" ON "session" ("userId");
CREATE INDEX "account_userId_idx" ON "account" ("userId");
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor" ("secret");
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor" ("userId");

RESET ROLE;
REVOKE ALL ON SCHEMA better_auth FROM PUBLIC;
GRANT USAGE ON SCHEMA better_auth TO quorum_auth_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA better_auth TO quorum_auth_runtime;
