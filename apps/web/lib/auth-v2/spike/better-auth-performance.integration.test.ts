import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildBetterAuthSpikeOptions } from "./better-auth-options";

const operatorURL = process.env.AUTH_PROVIDER_SPIKE_OPERATOR_DATABASE_URL;
if (!operatorURL) throw new Error("Provider integration database is required.");
let queryCount = 0;
const database = new Pool({
  allowExitOnIdle: true,
  connectionString: operatorURL,
  max: 1,
  options: "-c search_path=better_auth,pg_catalog,pg_temp",
});
database.on("connect", (client) => {
  const original = client.query.bind(client);
  client.query = ((...args: unknown[]) => {
    queryCount += 1;
    return Reflect.apply(original, client, args);
  }) as typeof client.query;
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

async function measure(operation: () => Promise<Response>) {
  queryCount = 0;
  const started = performance.now();
  const response = await operation();
  return {
    elapsedMs: performance.now() - started,
    queries: queryCount,
    response,
  };
}

describe("Better Auth session query and latency bounds", () => {
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
    const password = "eF5!".repeat(16);
    const signup = await auth.handler(
      new Request(`${baseURL}/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({
          email: "performance@example.test",
          name: "Performance Test",
          password,
        }),
      }),
    );
    expect(signup.status).toBe(200);
    await database.query(
      'UPDATE better_auth."user" SET "emailVerified" = true WHERE email = $1',
      ["performance@example.test"],
    );
  });

  afterAll(async () => {
    await database.query("DROP SCHEMA better_auth CASCADE");
    await database.end();
  });

  it("keeps create, lookup, and revoke bounded", async () => {
    const password = "eF5!".repeat(16);
    const created = await measure(() =>
      auth.handler(
        new Request(`${baseURL}/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin },
          body: JSON.stringify({ email: "performance@example.test", password }),
        }),
      ),
    );
    expect(created.response.status).toBe(200);
    const cookie = cookieFrom(created.response);

    const lookedUp = await measure(() =>
      auth.handler(
        new Request(`${baseURL}/get-session`, { headers: { cookie } }),
      ),
    );
    expect(lookedUp.response.status).toBe(200);

    const revoked = await measure(() =>
      auth.handler(
        new Request(`${baseURL}/revoke-sessions`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie, origin },
          body: "{}",
        }),
      ),
    );
    expect(revoked.response.status).toBe(200);

    const sanitized = {
      create: { elapsedMs: created.elapsedMs, queries: created.queries },
      lookup: { elapsedMs: lookedUp.elapsedMs, queries: lookedUp.queries },
      revoke: { elapsedMs: revoked.elapsedMs, queries: revoked.queries },
    };
    console.info("AUTH_SPIKE_PERF", sanitized);
    expect(sanitized).toMatchObject({
      create: { queries: expect.any(Number), elapsedMs: expect.any(Number) },
      lookup: { queries: expect.any(Number), elapsedMs: expect.any(Number) },
      revoke: { queries: expect.any(Number), elapsedMs: expect.any(Number) },
    });
    expect(sanitized.create.queries).toBeGreaterThan(0);
    expect(sanitized.create.queries).toBeLessThanOrEqual(12);
    expect(sanitized.lookup.queries).toBeGreaterThan(0);
    expect(sanitized.lookup.queries).toBeLessThanOrEqual(4);
    expect(sanitized.revoke.queries).toBeGreaterThan(0);
    expect(sanitized.revoke.queries).toBeLessThanOrEqual(6);
    expect(sanitized.create.elapsedMs).toBeLessThan(2_000);
    expect(sanitized.lookup.elapsedMs).toBeLessThan(500);
    expect(sanitized.revoke.elapsedMs).toBeLessThan(500);
  });
});
