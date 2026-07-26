import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PoolClient } from "pg";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getAuthProviderSpikeRuntimeConfig } from "./runtime-config";

const EXPECTED_TABLES = [
  "account",
  "rateLimit",
  "session",
  "twoFactor",
  "user",
  "verification",
] as const;

const schemaSQL = readFileSync(
  resolve(process.cwd(), "lib/auth-v2/spike/generated-schema.sql"),
  "utf8",
);
const runtime = getAuthProviderSpikeRuntimeConfig(process.env);
const pool = new Pool({
  allowExitOnIdle: true,
  connectionString: runtime.databaseURL,
  max: 1,
  options: runtime.postgresOptions,
});
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

  it("uses the exact isolated search path", async () => {
    const result = await client.query<{ search_path: string }>(
      "SELECT current_setting('search_path') AS search_path",
    );
    expect(result.rows[0]?.search_path).toBe(
      "better_auth, pg_catalog, pg_temp",
    );
  });

  it("creates only the reviewed tables under the auth owner", async () => {
    const result = await client.query<{ owner: string; table_name: string }>(`
      SELECT owner.rolname AS owner, class.relname AS table_name
      FROM pg_class class
      JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
      JOIN pg_roles owner ON owner.oid = class.relowner
      WHERE namespace.nspname = 'better_auth'
        AND class.relkind = 'r'
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
      `
        SELECT count(*)::text AS object_count
        FROM pg_class class
        JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
        WHERE namespace.nspname IN ('public', 'auth')
          AND class.relname = ANY($1::text[])
      `,
      [[...EXPECTED_TABLES]],
    );

    expect(result.rows[0]?.object_count).toBe("0");
  });
});
