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

describe("Better Auth reconciliation fallback feasibility", () => {
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

  it("detects and repairs a deliberately lost event without granting access", async () => {
    const signup = await auth.handler(
      new Request(`${baseURL}/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({
          email: "sync@example.test",
          name: "Sync Test",
          password: "gH6!".repeat(16),
        }),
      }),
    );
    expect(signup.status).toBe(200);

    const client = await database.connect();
    try {
      await client.query(`CREATE TEMP TABLE auth_projection_spike (
        auth_user_id text PRIMARY KEY,
        source_version timestamptz NOT NULL,
        eligible boolean NOT NULL DEFAULT false
      )`);
      const driftQuery = `SELECT source.id, source."updatedAt"
        FROM better_auth."user" source
        LEFT JOIN auth_projection_spike projection
          ON projection.auth_user_id = source.id
        WHERE projection.auth_user_id IS NULL
           OR projection.source_version < source."updatedAt"`;

      const lostEvent = await client.query<{ id: string; updatedAt: Date }>(
        driftQuery,
      );
      expect(lostEvent.rows).toHaveLength(1);
      const userId = lostEvent.rows[0]?.id;
      const accessBeforeRepair = await client.query<{ allowed: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM auth_projection_spike WHERE auth_user_id = $1 AND eligible) AS allowed",
        [userId],
      );
      expect(accessBeforeRepair.rows[0]?.allowed).toBe(false);

      await client.query("BEGIN");
      await client.query(
        `INSERT INTO auth_projection_spike (auth_user_id, source_version, eligible)
         VALUES ($1, $2, false)
         ON CONFLICT (auth_user_id) DO UPDATE
           SET source_version = EXCLUDED.source_version, eligible = false`,
        [userId, lostEvent.rows[0]?.updatedAt],
      );
      await client.query("COMMIT");
      expect((await client.query(driftQuery)).rows).toHaveLength(0);

      await client.query(
        `UPDATE better_auth."user"
         SET name = 'Sync Test Updated', "updatedAt" = now() + interval '1 second'
         WHERE id = $1`,
        [userId],
      );
      const laterDrift = await client.query<{ id: string; updatedAt: Date }>(
        driftQuery,
      );
      expect(laterDrift.rows).toHaveLength(1);
      const accessDuringDrift = await client.query<{ allowed: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM auth_projection_spike WHERE auth_user_id = $1 AND eligible) AS allowed",
        [userId],
      );
      expect(accessDuringDrift.rows[0]?.allowed).toBe(false);

      await client.query(
        `UPDATE auth_projection_spike projection
         SET source_version = source."updatedAt", eligible = false
         FROM better_auth."user" source
         WHERE projection.auth_user_id = source.id AND source.id = $1`,
        [userId],
      );
      expect((await client.query(driftQuery)).rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });
});
