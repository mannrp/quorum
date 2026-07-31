import { getMigrations as getCurrentMigrations } from "better-auth/db/migration";
import { haveIBeenPwned, twoFactor } from "better-auth/plugins";
import { getMigrations as getPreviousMigrations } from "better-auth-previous/db/migration";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const operatorURL = process.env.AUTH_PROVIDER_SPIKE_OPERATOR_DATABASE_URL;
if (!operatorURL) throw new Error("Provider integration database is required.");
const schema = "better_auth_upgrade_spike";
const database = new Pool({
  allowExitOnIdle: true,
  connectionString: operatorURL,
  max: 1,
  options: `-c search_path=${schema},pg_catalog,pg_temp`,
});
const noopMail = async () => undefined;

function options() {
  return {
    advanced: { useSecureCookies: true },
    appName: "Quorum Auth V2 Upgrade Spike",
    baseURL: "http://127.0.0.1:3000/api/auth-v2-spike",
    database,
    emailAndPassword: {
      enabled: true,
      maxPasswordLength: 256,
      minPasswordLength: 29,
      requireEmailVerification: true,
      sendResetPassword: noopMail,
    },
    emailVerification: { sendVerificationEmail: noopMail },
    plugins: [
      haveIBeenPwned({ enabled: true }),
      twoFactor({
        allowPasswordless: false,
        issuer: "Quorum Auth V2 Upgrade Spike",
        skipVerificationOnEnable: false,
      }),
    ],
    rateLimit: { enabled: true, storage: "database" as const },
    secret: "local-only-auth-spike-secret-32-characters",
    session: {
      additionalFields: {
        absoluteExpiresAt: { input: false, required: true, type: "date" as const },
        assurance: { input: false, required: true, type: "string" as const },
        authenticatedAt: { input: false, required: true, type: "date" as const },
        authenticationMethods: {
          input: false,
          required: true,
          type: "string" as const,
        },
        lastSeenAt: { input: false, required: true, type: "date" as const },
      },
      cookieCache: { enabled: false },
      expiresIn: 86_400,
      freshAge: 600,
      updateAge: 900,
    },
    trustedOrigins: ["http://127.0.0.1:3000"],
  };
}

describe("Better Auth deterministic patch upgrade", () => {
  beforeAll(async () => {
    const existing = await database.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS exists",
      [schema],
    );
    expect(existing.rows[0]?.exists).toBe(false);
    await database.query(`CREATE SCHEMA ${schema}`);
  });

  afterAll(async () => {
    await database.query(`DROP SCHEMA ${schema} CASCADE`);
    await database.end();
  });

  it("upgrades 1.6.24 to 1.6.25 without destructive SQL or session loss", async () => {
    const previous = await getPreviousMigrations(
      options() as Parameters<typeof getPreviousMigrations>[0],
    );
    const previousSQL = await previous.compileMigrations();
    expect(previousSQL).not.toMatch(/\bDROP\b/i);
    expect(previous.toBeCreated.length).toBeGreaterThan(0);
    await previous.runMigrations();

    await database.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       VALUES ('upgrade-user', 'Upgrade Test', 'upgrade@example.test', true, now(), now())`,
    );
    await database.query(
      `INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId",
                            "absoluteExpiresAt", assurance, "authenticatedAt", "authenticationMethods", "lastSeenAt")
       VALUES ('upgrade-session', now() + interval '1 hour', 'upgrade-token-fixture', now(), now(), 'upgrade-user',
               now() + interval '7 days', 'aal1', now(), '["password"]', now())`,
    );

    const current = await getCurrentMigrations(options());
    const forwardSQL = await current.compileMigrations();
    expect(forwardSQL).not.toMatch(/\b(DROP|TRUNCATE)\b/i);
    await current.runMigrations();

    const preserved = await database.query<{
      session_count: string;
      user_count: string;
    }>(`SELECT
      (SELECT count(*)::text FROM session WHERE id = 'upgrade-session') AS session_count,
      (SELECT count(*)::text FROM "user" WHERE id = 'upgrade-user') AS user_count`);
    expect(preserved.rows[0]).toEqual({
      session_count: "1",
      user_count: "1",
    });
    expect(current.toBeCreated).toEqual([]);
    expect(current.toBeAdded).toEqual([]);
  });
});
