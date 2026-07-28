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
  max: 3,
  options: "-c search_path=better_auth,pg_catalog,pg_temp",
});
function candidate() {
  const options = buildBetterAuthSpikeOptions({
    database,
    baseURL: "http://127.0.0.1:3000/api/auth-v2-spike",
    secret: "local-only-auth-spike-secret-32-characters",
    trustedOrigins: ["http://127.0.0.1:3000"],
    sendChangeEmailConfirmation: async () => undefined,
    sendResetPassword: async () => undefined,
    sendVerificationEmail: async () => undefined,
  });
  return betterAuth({
    ...options,
    rateLimit: { enabled: true, max: 2, storage: "database", window: 60 },
  });
}
function signInRequest(): Request {
  return new Request(
    "http://127.0.0.1:3000/api/auth-v2-spike/sign-in/email",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:3000",
        "x-forwarded-for": "192.0.2.10",
      },
      body: JSON.stringify({
        email: "missing@example.test",
        password: "aB3!".repeat(16),
      }),
    },
  );
}

describe("Better Auth shared rate limiting", () => {
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

  it("shares a database-backed budget across two instances", async () => {
    const first = candidate();
    const second = candidate();
    expect((await first.handler(signInRequest())).status).toBe(401);
    expect((await first.handler(signInRequest())).status).toBe(401);
    expect((await first.handler(signInRequest())).status).toBe(401);
    expect((await second.handler(signInRequest())).status).toBe(429);
    const rows = await database.query<{ count: number }>(
      'SELECT count FROM better_auth."rateLimit"',
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.count).toBeGreaterThanOrEqual(3);
  });

  it("fails closed when the shared store is unavailable", async () => {
    const instance = candidate();
    await database.query('DROP TABLE better_auth."rateLimit"');
    await expect(instance.handler(signInRequest())).rejects.toThrow(
      /rateLimit|does not exist/i,
    );
  });
});
