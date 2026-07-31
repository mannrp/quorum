import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildBetterAuthSpikeOptions } from "./better-auth-options";
import {
  assessBetterAuthSession,
  type BetterAuthSessionPolicyRecord,
} from "./better-auth-session-policy";

const operatorURL = process.env.AUTH_PROVIDER_SPIKE_OPERATOR_DATABASE_URL;
if (!operatorURL) throw new Error("Provider integration database is required.");
const database = new Pool({
  allowExitOnIdle: true,
  connectionString: operatorURL,
  max: 2,
  options: "-c search_path=better_auth,pg_catalog,pg_temp",
});
const origin = "http://127.0.0.1:3000";
const baseURL = `${origin}/api/auth-v2-spike`;
const auth = betterAuth(
  buildBetterAuthSpikeOptions({
    database,
    baseURL,
    secret: "local-only-auth-spike-secret-32-characters",
    trustedOrigins: [origin],
    sendChangeEmailConfirmation: async () => undefined,
    sendResetPassword: async () => undefined,
    sendVerificationEmail: async () => undefined,
  }),
);

async function mutation(path: string, body: unknown) {
  return auth.handler(
    new Request(`${baseURL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(body),
    }),
  );
}

async function sessionRecord(token: string) {
  const result = await database.query<BetterAuthSessionPolicyRecord>(
    `SELECT "absoluteExpiresAt", assurance, "authenticatedAt",
            "authenticationMethods", "expiresAt", "lastSeenAt"
     FROM better_auth.session WHERE token = $1`,
    [token],
  );
  expect(result.rows).toHaveLength(1);
  return result.rows[0] as BetterAuthSessionPolicyRecord;
}

describe("Better Auth live BFF session policy evidence", () => {
  beforeAll(async () => {
    const schemaSQL = readFileSync(
      resolve(process.cwd(), "lib/auth-v2/spike/better-auth-schema.sql"),
      "utf8",
    );
    const existing = await database.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'better_auth') AS exists",
    );
    expect(existing.rows[0]?.exists).toBe(false);
    await database.query(schemaSQL);
  });

  afterAll(async () => {
    await database.query("DROP SCHEMA better_auth CASCADE");
    await database.end();
  });

  it("fails closed at absolute, idle, and malformed-context boundaries", async () => {
    const email = "policy@example.test";
    const password = "kL8!".repeat(16);
    expect(
      (await mutation("/sign-up/email", { email, name: "Policy Test", password }))
        .status,
    ).toBe(200);
    await database.query(
      'UPDATE better_auth."user" SET "emailVerified" = true WHERE email = $1',
      [email],
    );
    const signin = await mutation("/sign-in/email", { email, password });
    expect(signin.status).toBe(200);
    const body = (await signin.json()) as { token: string };

    expect(assessBetterAuthSession(await sessionRecord(body.token), new Date())).toMatchObject({
      allowed: true,
      assurance: "aal1",
      authenticationMethods: ["password"],
      recent: true,
    });

    await database.query(
      'UPDATE better_auth.session SET "absoluteExpiresAt" = now() - interval \'1 second\' WHERE token = $1',
      [body.token],
    );
    expect(
      assessBetterAuthSession(await sessionRecord(body.token), new Date()),
    ).toEqual({ allowed: false, reason: "absolute-expired" });

    await database.query(
      `UPDATE better_auth.session
       SET "absoluteExpiresAt" = now() + interval '1 day',
           "expiresAt" = now() - interval '1 second'
       WHERE token = $1`,
      [body.token],
    );
    expect(
      assessBetterAuthSession(await sessionRecord(body.token), new Date()),
    ).toEqual({ allowed: false, reason: "idle-expired" });

    await database.query(
      `UPDATE better_auth.session
       SET "expiresAt" = now() + interval '1 day', "authenticationMethods" = '[]'
       WHERE token = $1`,
      [body.token],
    );
    expect(
      assessBetterAuthSession(await sessionRecord(body.token), new Date()),
    ).toEqual({ allowed: false, reason: "authentication-context-invalid" });
  });
});
