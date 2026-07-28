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
const schemaSQL = readFileSync(
  resolve(process.cwd(), "lib/auth-v2/spike/better-auth-schema.sql"),
  "utf8",
);
const database = new Pool({
  allowExitOnIdle: true,
  connectionString: operatorURL,
  max: 2,
  options: "-c search_path=better_auth,pg_catalog,pg_temp",
});
const deliveredPurposes: string[] = [];
const auth = betterAuth(
  buildBetterAuthSpikeOptions({
    database,
    baseURL: "http://127.0.0.1:3000/api/auth-v2-spike",
    secret: "local-only-auth-spike-secret-32-characters",
    trustedOrigins: ["http://127.0.0.1:3000"],
    sendChangeEmailConfirmation: async () => {
      deliveredPurposes.push("change-email");
    },
    sendResetPassword: async () => {
      deliveredPurposes.push("reset-password");
    },
    sendVerificationEmail: async () => {
      deliveredPurposes.push("verify-email");
    },
  }),
);

function signupRequest(email: string, password: string): Request {
  return new Request(
    "http://127.0.0.1:3000/api/auth-v2-spike/sign-up/email",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:3000",
      },
      body: JSON.stringify({ email, name: "A03 Test User", password }),
    },
  );
}

describe("Better Auth 1.6.25 live provider acceptance", () => {
  beforeAll(async () => {
    const existing = await database.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'better_auth') AS exists",
    );
    expect(existing.rows[0]?.exists).toBe(false);
    await database.query("BEGIN");
    try {
      await database.query(schemaSQL);
      await database.query("COMMIT");
    } catch (error) {
      await database.query("ROLLBACK");
      throw error;
    }
  });

  afterAll(async () => {
    await database.query("DROP SCHEMA better_auth CASCADE");
    await database.end();
  });

  it("enforces the conservative Unicode boundary without custom validation", async () => {
    const below = await auth.handler(
      signupRequest("below@example.test", "\u{1F512}".repeat(14)),
    );
    expect(below.status).toBe(400);

    const minimum = await auth.handler(
      signupRequest("minimum@example.test", "\u{1F512}".repeat(15)),
    );
    expect(minimum.status).toBe(200);

    const supported = await auth.handler(
      signupRequest("supported@example.test", "aB3!".repeat(16)),
    );
    expect(supported.status).toBe(200);
    expect(deliveredPurposes).toEqual(["verify-email", "verify-email"]);

    const persisted = await database.query<{
      account_count: string;
      plaintext_count: string;
    }>(`SELECT
      count(*)::text AS account_count,
      count(*) FILTER (WHERE password IN ($1, $2))::text AS plaintext_count
      FROM better_auth.account`, ["\u{1F512}".repeat(15), "aB3!".repeat(16)]);
    expect(persisted.rows[0]).toEqual({
      account_count: "2",
      plaintext_count: "0",
    });
  });

  it("rejects a wrong-origin mutation", async () => {
    const request = signupRequest("wrong-origin@example.test", "aB3!".repeat(16));
    request.headers.set("origin", "https://wrong-origin.example");
    const response = await auth.handler(request);
    expect(response.status).toBe(403);
  });
});
