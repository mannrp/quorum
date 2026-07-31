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
const baseOptions = buildBetterAuthSpikeOptions({
  database,
  baseURL,
  secret: "local-only-auth-spike-secret-32-characters",
  trustedOrigins: [origin],
  sendChangeEmailConfirmation: async () => undefined,
  sendResetPassword: async () => undefined,
  sendVerificationEmail: async () => undefined,
});
const auth = betterAuth({
  ...baseOptions,
  rateLimit: { enabled: true, max: 100, storage: "database", window: 60 },
});

function cookieFrom(response: Response): string {
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("Expected a provider session cookie.");
  return cookie;
}

async function post(path: string, body: unknown, cookie?: string) {
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

async function get(path: string, cookie: string) {
  return auth.handler(
    new Request(`${baseURL}${path}`, { headers: { cookie } }),
  );
}

async function signIn(email: string, password: string) {
  await database.query('DELETE FROM better_auth."rateLimit"');
  const response = await post("/sign-in/email", { email, password });
  expect(response.status).toBe(200);
  const body = (await response.clone().json()) as { token: string };
  return { cookie: cookieFrom(response), token: body.token };
}

describe("Better Auth database session lifecycle", () => {
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

  it("lists and revokes current, other, named, and all sessions immediately", async () => {
    const email = "lifecycle@example.test";
    const password = "aB3!".repeat(16);
    expect(
      (await post("/sign-up/email", { email, name: "Lifecycle Test", password }))
        .status,
    ).toBe(200);
    await database.query(
      'UPDATE better_auth."user" SET "emailVerified" = true WHERE email = $1',
      [email],
    );

    const first = await signIn(email, password);
    const second = await signIn(email, password);
    const listed = await get("/list-sessions", second.cookie);
    expect(listed.status).toBe(200);
    expect((await listed.json()) as unknown[]).toHaveLength(2);

    expect((await post("/revoke-other-sessions", {}, second.cookie)).status).toBe(
      200,
    );
    expect(await (await get("/get-session", first.cookie)).json()).toBeNull();
    expect(await (await get("/get-session", second.cookie)).json()).toMatchObject({
      user: { email },
    });

    const named = await signIn(email, password);
    expect(
      (await post("/revoke-session", { token: named.token }, second.cookie)).status,
    ).toBe(200);
    expect(await (await get("/get-session", named.cookie)).json()).toBeNull();

    const finalOther = await signIn(email, password);
    expect((await post("/revoke-sessions", {}, second.cookie)).status).toBe(200);
    expect(await (await get("/get-session", second.cookie)).json()).toBeNull();
    expect(await (await get("/get-session", finalOther.cookie)).json()).toBeNull();
  });

  it("enforces database expiry and the recent-authentication boundary", async () => {
    const email = "boundaries@example.test";
    const password = "cD4!".repeat(16);
    expect(
      (await post("/sign-up/email", { email, name: "Boundary Test", password }))
        .status,
    ).toBe(200);
    await database.query(
      'UPDATE better_auth."user" SET "emailVerified" = true WHERE email = $1',
      [email],
    );

    const expired = await signIn(email, password);
    await database.query(
      'UPDATE better_auth.session SET "expiresAt" = now() - interval \'1 second\' WHERE token = $1',
      [expired.token],
    );
    expect(await (await get("/get-session", expired.cookie)).json()).toBeNull();

    const staleAuthentication = await signIn(email, password);
    await database.query(
      'UPDATE better_auth.session SET "createdAt" = now() - interval \'601 seconds\' WHERE token = $1',
      [staleAuthentication.token],
    );
    const sensitive = await get("/list-sessions", staleAuthentication.cookie);
    expect(sensitive.status).toBe(403);
    expect((await sensitive.json()) as { code?: string }).toMatchObject({
      code: "SESSION_NOT_FRESH",
    });
  });
});
