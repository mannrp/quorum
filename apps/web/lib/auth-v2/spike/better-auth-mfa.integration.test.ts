import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
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

function cookieFrom(response: Response): string {
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("Expected a provider session cookie.");
  return cookie;
}

function mutation(path: string, body: unknown, cookie?: string): Request {
  return new Request(`${baseURL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("Better Auth maintained MFA lifecycle", () => {
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

  it("enrolls, verifies, recovers, prevents replay, and disables TOTP", async () => {
    const email = "mfa@example.test";
    const password = "aB3!".repeat(16);
    expect(
      (
        await auth.handler(
          mutation("/sign-up/email", { email, name: "MFA Test", password }),
        )
      ).status,
    ).toBe(200);
    await database.query(
      'UPDATE better_auth."user" SET "emailVerified" = true WHERE email = $1',
      [email],
    );
    const signin = await auth.handler(
      mutation("/sign-in/email", { email, password }),
    );
    expect(signin.status).toBe(200);
    const initialCookie = cookieFrom(signin);

    const wrongPassword = await auth.handler(
      mutation("/two-factor/enable", { password: "wrong-password" }, initialCookie),
    );
    expect(wrongPassword.status).toBe(400);

    const enrollment = await auth.handler(
      mutation("/two-factor/enable", { password }, initialCookie),
    );
    expect(enrollment.status).toBe(200);
    const enrollmentBody = (await enrollment.json()) as {
      backupCodes: string[];
      totpURI: string;
    };
    expect(enrollmentBody.backupCodes).toHaveLength(10);
    const secret = new URL(enrollmentBody.totpURI).searchParams.get("secret");
    expect(secret).toEqual(expect.any(String));

    const stored = await database.query<{
      backupCodes: string;
      secret: string;
      verified: boolean;
    }>('SELECT "backupCodes", secret, verified FROM better_auth."twoFactor"');
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]?.verified).toBe(false);
    expect(stored.rows[0]?.secret).not.toContain(secret ?? "");
    for (const code of enrollmentBody.backupCodes) {
      expect(stored.rows[0]?.backupCodes).not.toContain(code);
    }

    const invalid = await auth.handler(
      mutation("/two-factor/verify-totp", { code: "000000" }, initialCookie),
    );
    expect(invalid.status).toBe(401);

    const rawSecret = new TextDecoder().decode(base32.decode(secret ?? ""));
    const code = await createOTP(rawSecret).totp();
    const verified = await auth.handler(
      mutation("/two-factor/verify-totp", { code }, initialCookie),
    );
    if (verified.status !== 200) {
      const error = (await verified.clone().json()) as { code?: string };
      throw new Error(`TOTP verification failed: ${verified.status} ${error.code ?? "unknown"}`);
    }
    const verifiedCookie = cookieFrom(verified);
    const enabled = await database.query<{
      enabled: boolean;
      verified: boolean;
    }>(`SELECT u."twoFactorEnabled" AS enabled, f.verified
       FROM better_auth."user" u
       JOIN better_auth."twoFactor" f ON f."userId" = u.id
       WHERE u.email = $1`, [email]);
    expect(enabled.rows[0]).toEqual({ enabled: true, verified: true });
    const elevatedContext = await database.query<{
      absoluteExpiresAt: Date;
      assurance: string;
      authenticatedAt: Date;
      authenticationMethods: string;
    }>(`SELECT s."absoluteExpiresAt", s.assurance, s."authenticatedAt",
              s."authenticationMethods"
       FROM better_auth.session s
       JOIN better_auth."user" u ON u.id = s."userId"
       WHERE u.email = $1 ORDER BY s."createdAt" DESC LIMIT 1`, [email]);
    expect(elevatedContext.rows[0]).toMatchObject({
      assurance: "aal2",
      authenticationMethods: '["password","totp"]',
    });
    expect(elevatedContext.rows[0]?.absoluteExpiresAt.getTime()).toBeGreaterThan(
      elevatedContext.rows[0]?.authenticatedAt.getTime() ?? Number.MAX_SAFE_INTEGER,
    );

    const backupCode = enrollmentBody.backupCodes[0];
    const recovered = await auth.handler(
      mutation("/two-factor/verify-backup-code", { code: backupCode }, verifiedCookie),
    );
    expect(recovered.status).toBe(200);
    const replay = await auth.handler(
      mutation("/two-factor/verify-backup-code", { code: backupCode }, verifiedCookie),
    );
    expect(replay.status).toBe(401);

    const disabled = await auth.handler(
      mutation("/two-factor/disable", { password }, verifiedCookie),
    );
    expect(disabled.status).toBe(200);
    const finalState = await database.query<{
      enabled: boolean;
      factors: string;
    }>(`SELECT u."twoFactorEnabled" AS enabled,
              (SELECT count(*)::text FROM better_auth."twoFactor") AS factors
       FROM better_auth."user" u WHERE u.email = $1`, [email]);
    expect(finalState.rows[0]).toEqual({ enabled: false, factors: "0" });
  });
});
