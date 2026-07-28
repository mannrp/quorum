import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildBetterAuthSpikeOptions } from "./better-auth-options";

const operatorURL = process.env.AUTH_PROVIDER_SPIKE_OPERATOR_DATABASE_URL;
if (!operatorURL) {
  throw new Error(
    "AUTH_PROVIDER_SPIKE_OPERATOR_DATABASE_URL is required for provider integration tests.",
  );
}
const database = new Pool({
  allowExitOnIdle: true,
  connectionString: operatorURL,
  max: 2,
  options: "-c search_path=better_auth,pg_catalog,pg_temp",
});
const auth = betterAuth(
  buildBetterAuthSpikeOptions({
    database,
    baseURL: "http://127.0.0.1:3000/api/auth-v2-spike",
    secret: "local-only-auth-spike-secret-32-characters",
    trustedOrigins: ["http://127.0.0.1:3000"],
    sendChangeEmailConfirmation: async () => undefined,
    sendResetPassword: async () => undefined,
    sendVerificationEmail: async () => undefined,
  }),
);
const originHeaders = {
  "content-type": "application/json",
  origin: "http://127.0.0.1:3000",
};

describe("Better Auth database-session credential behavior", () => {
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

  it("requires the signed host-only cookie and denies the database token alone", async () => {
    const password = "aB3!".repeat(16);
    const signup = await auth.handler(
      new Request("http://127.0.0.1:3000/api/auth-v2-spike/sign-up/email", {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({
          email: "session@example.test",
          name: "Session Test",
          password,
        }),
      }),
    );
    expect(signup.status).toBe(200);
    await database.query(
      'UPDATE better_auth."user" SET "emailVerified" = true WHERE email = $1',
      ["session@example.test"],
    );

    const signin = await auth.handler(
      new Request("http://127.0.0.1:3000/api/auth-v2-spike/sign-in/email", {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({ email: "session@example.test", password }),
      }),
    );
    expect(signin.status).toBe(200);
    const body = (await signin.json()) as { token?: string };
    expect(body.token).toEqual(expect.any(String));

    const persisted = await database.query<{ token: string }>(
      "SELECT token FROM better_auth.session",
    );
    expect(persisted.rows).toHaveLength(1);
    expect(persisted.rows[0]?.token).toBe(body.token);

    const setCookie = signin.headers.get("set-cookie");
    expect(setCookie).toContain(
      "__Secure-quorum_auth_v2_spike.session_token=",
    );
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    const signedCookie = setCookie?.split(";", 1)[0];
    expect(signedCookie).toBeTruthy();

    const rawCookie = `__Secure-quorum_auth_v2_spike.session_token=${encodeURIComponent(body.token ?? "")}`;
    const rawResponse = await auth.handler(
      new Request("http://127.0.0.1:3000/api/auth-v2-spike/get-session", {
        headers: { cookie: rawCookie },
      }),
    );
    expect(await rawResponse.json()).toBeNull();

    const bearerResponse = await auth.handler(
      new Request("http://127.0.0.1:3000/api/auth-v2-spike/get-session", {
        headers: { authorization: `Bearer ${body.token}` },
      }),
    );
    expect(await bearerResponse.json()).toBeNull();

    const signedResponse = await auth.handler(
      new Request("http://127.0.0.1:3000/api/auth-v2-spike/get-session", {
        headers: { cookie: signedCookie ?? "" },
      }),
    );
    expect(await signedResponse.json()).toMatchObject({
      user: { email: "session@example.test" },
    });
  });
});
