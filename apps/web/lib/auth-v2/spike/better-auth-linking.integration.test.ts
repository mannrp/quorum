import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildBetterAuthSpikeOptions } from "./better-auth-options";

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

function cookieFrom(response: Response): string {
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("Expected a provider session cookie.");
  return cookie;
}

async function mutation(path: string, body: unknown, cookie?: string) {
  return auth.handler(
    new Request(`${baseURL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("Better Auth explicit linking and safe unlinking", () => {
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

  it("lists an explicitly attached method and refuses to unlink the last one", async () => {
    const email = "linking@example.test";
    const password = "iJ7!".repeat(16);
    expect(
      (await mutation("/sign-up/email", { email, name: "Link Test", password }))
        .status,
    ).toBe(200);
    await database.query(
      'UPDATE better_auth."user" SET "emailVerified" = true WHERE email = $1',
      [email],
    );
    const signin = await mutation("/sign-in/email", { email, password });
    expect(signin.status).toBe(200);
    const cookie = cookieFrom(signin);
    const user = await database.query<{ id: string }>(
      'SELECT id FROM better_auth."user" WHERE email = $1',
      [email],
    );
    const userId = user.rows[0]?.id;

    // The deterministic OAuth harness proves the redirect/callback ceremony;
    // this fixture represents its successful explicit-link result so the
    // provider's account lifecycle can be tested without external identity.
    await database.query(
      `INSERT INTO better_auth.account
       (id, "accountId", "providerId", "userId", "createdAt", "updatedAt")
       VALUES ('explicit-link-fixture', 'local-subject', 'local-oidc', $1, now(), now())`,
      [userId],
    );
    const listed = await auth.handler(
      new Request(`${baseURL}/list-accounts`, { headers: { cookie } }),
    );
    expect(listed.status).toBe(200);
    const accounts = (await listed.json()) as Array<{
      accountId: string;
      providerId: string;
      userId: string;
    }>;
    expect(accounts).toHaveLength(2);
    expect(accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: "local-subject",
          providerId: "local-oidc",
          userId,
        }),
      ]),
    );

    const unknown = await mutation(
      "/unlink-account",
      { providerId: "unknown" },
      cookie,
    );
    expect(unknown.status).toBe(400);
    const unlinked = await mutation(
      "/unlink-account",
      { accountId: "local-subject", providerId: "local-oidc" },
      cookie,
    );
    expect(unlinked.status).toBe(200);
    const lastMethod = await mutation(
      "/unlink-account",
      { providerId: "credential" },
      cookie,
    );
    expect(lastMethod.status).toBe(400);
    expect((await database.query('SELECT 1 FROM better_auth.account')).rows).toHaveLength(1);
  });
});
