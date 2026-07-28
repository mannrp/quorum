import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PoolClient } from "pg";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const EXPECTED_TABLES = [
  "account",
  "rateLimit",
  "session",
  "twoFactor",
  "user",
  "verification",
] as const;
const operatorURL = process.env.AUTH_PROVIDER_SPIKE_OPERATOR_DATABASE_URL;
if (!operatorURL) {
  throw new Error(
    "AUTH_PROVIDER_SPIKE_OPERATOR_DATABASE_URL is required for provider integration tests.",
  );
}
const pool = new Pool({
  allowExitOnIdle: true,
  connectionString: operatorURL,
  max: 1,
  options: "-c search_path=better_auth,pg_catalog,pg_temp",
});
const schemaSQL = readFileSync(
  resolve(process.cwd(), "lib/auth-v2/spike/better-auth-schema.sql"),
  "utf8",
);
let client: PoolClient;

describe("Better Auth PostgreSQL schema isolation", () => {
  beforeAll(async () => {
    client = await pool.connect();
    await client.query("BEGIN");
    const existing = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'better_auth') AS exists",
    );
    expect(existing.rows[0]?.exists).toBe(false);
    await client.query(schemaSQL);
  });

  afterAll(async () => {
    if (client) {
      await client.query("ROLLBACK");
      client.release();
    }
    await pool.end();
  });

  it("creates only the reviewed tables under the auth owner", async () => {
    const result = await client.query<{ owner: string; table_name: string }>(`
      SELECT owner.rolname AS owner, class.relname AS table_name
      FROM pg_class class
      JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
      JOIN pg_roles owner ON owner.oid = class.relowner
      WHERE namespace.nspname = 'better_auth' AND class.relkind = 'r'
      ORDER BY class.relname
    `);
    expect(result.rows.map(({ table_name }) => table_name)).toEqual(
      EXPECTED_TABLES,
    );
    expect(new Set(result.rows.map(({ owner }) => owner))).toEqual(
      new Set(["quorum_auth_owner"]),
    );
  });

  it("leaves public and Supabase auth free of candidate objects", async () => {
    const result = await client.query<{ object_count: string }>(
      `SELECT count(*)::text AS object_count
       FROM pg_class class
       JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
       WHERE namespace.nspname IN ('public', 'auth')
         AND class.relname = ANY($1::text[])`,
      [[...EXPECTED_TABLES]],
    );
    expect(result.rows[0]?.object_count).toBe("0");
  });

  it("grants only the auth runtime access", async () => {
    const result = await client.query<{
      app_select: boolean;
      auth_select: boolean;
    }>(`SELECT
      has_table_privilege('quorum_app_runtime', 'better_auth.session', 'SELECT') AS app_select,
      has_table_privilege('quorum_auth_runtime', 'better_auth.session', 'SELECT') AS auth_select`);
    expect(result.rows[0]).toEqual({ app_select: false, auth_select: true });
  });
});
