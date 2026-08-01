import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";

const purpose = "quorum:email-verification";
const lifetimeSeconds = 3_600;

function digest(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

export class VerificationTokenStore {
  constructor(private readonly database: Pool) {}

  async issue(token: string): Promise<void> {
    await this.database.query(
      'INSERT INTO "verification" ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt") VALUES ($1, $2, $3, now() + make_interval(secs => $4), now(), now())',
      [randomUUID(), purpose, digest(token), lifetimeSeconds],
    );
  }

  async consume(token: string): Promise<boolean> {
    const result = await this.database.query(
      'DELETE FROM "verification" WHERE "identifier" = $1 AND "value" = $2 AND "expiresAt" > now() RETURNING "id"',
      [purpose, digest(token)],
    );
    return result.rowCount === 1;
  }
}
