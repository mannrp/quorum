import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaSQL = readFileSync(
  resolve(process.cwd(), "lib/auth-v2/spike/generated-schema.sql"),
  "utf8",
);

describe("reviewed Better Auth schema output", () => {
  it("pins schema placement before executing generated DDL", () => {
    expect(schemaSQL).toContain(
      "SET LOCAL search_path = better_auth, pg_catalog, pg_temp;",
    );
    expect(schemaSQL).toContain("current_schema() <> 'better_auth'");
  });

  it("contains only the expected candidate tables and no second migration ledger", () => {
    const tables = [...schemaSQL.matchAll(/create table \"([^\"]+)\"/g)].map(
      ([, table]) => table,
    );

    expect(tables).toEqual([
      "user",
      "session",
      "account",
      "verification",
      "twoFactor",
      "rateLimit",
    ]);
    expect(schemaSQL).not.toMatch(/schema_migrations|better_auth_migrations/i);
    expect(schemaSQL).not.toMatch(/(?:public|auth)\s*\./i);
  });
});
