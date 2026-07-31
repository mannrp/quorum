import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { betterAuth } from "better-auth";
import nodemailer from "nodemailer";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildBetterAuthSpikeOptions } from "./better-auth-options";
import { MailpitAcceptanceClient } from "./mailpit-acceptance";

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
const mail = nodemailer.createTransport({
  host: "127.0.0.1",
  port: 1025,
  secure: false,
});
const mailpit = new MailpitAcceptanceClient({
  apiUrl: "http://127.0.0.1:8025",
});
const sender = "no-reply@quorum.example.test";
const auth = betterAuth(
  buildBetterAuthSpikeOptions({
    database,
    baseURL,
    secret: "local-only-auth-spike-secret-32-characters",
    trustedOrigins: [origin],
    sendVerificationEmail: async ({ user, url }) => {
      await mail.sendMail({
        from: sender,
        to: user.email,
        subject: "Verify your Quorum account",
        text: url,
      });
    },
    sendResetPassword: async ({ user, url }) => {
      await mail.sendMail({
        from: sender,
        to: user.email,
        subject: "Reset your Quorum password",
        text: url,
      });
    },
    sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
      await mail.sendMail({
        from: sender,
        to: user.email,
        subject: `Confirm Quorum email change to ${newEmail}`,
        text: url,
      });
    },
  }),
);

function cookieFrom(response: Response): string {
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("Expected a provider session cookie.");
  return cookie;
}

async function mutation(path: string, body: unknown, cookie?: string) {
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

describe("Better Auth hooks deliver through Mailpit", () => {
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
    await mail.verify();
  });

  afterAll(async () => {
    mail.close();
    await database.query("DROP SCHEMA better_auth CASCADE");
    await database.end();
  });

  it("delivers purpose-bound verification, reset, and change messages", async () => {
    const email = "mailpit-a03@example.test";
    const newEmail = "mailpit-a03-new@example.test";
    const password = "mN9!".repeat(16);
    expect(
      (await mutation("/sign-up/email", { email, name: "Mailpit Test", password }))
        .status,
    ).toBe(200);
    await expect(
      mailpit.waitForAndExercise({
        recipient: email,
        subject: "Verify your Quorum account",
        timeoutMs: 5_000,
        exercise: async (message) => {
          const link = new URL(message.text.trim());
          return link.origin === origin && link.searchParams.has("token");
        },
      }),
    ).resolves.toEqual({ delivered: true, exercised: true });

    expect((await mutation("/request-password-reset", { email })).status).toBe(200);
    await expect(
      mailpit.waitForAndExercise({
        recipient: email,
        subject: "Reset your Quorum password",
        timeoutMs: 5_000,
        exercise: async (message) => {
          const link = new URL(message.text.trim());
          return (
            link.origin === origin &&
            link.pathname.startsWith(
              "/api/auth-v2-spike/reset-password/",
            ) &&
            link.searchParams.has("callbackURL")
          );
        },
      }),
    ).resolves.toEqual({ delivered: true, exercised: true });

    await database.query(
      'UPDATE better_auth."user" SET "emailVerified" = true WHERE email = $1',
      [email],
    );
    const signin = await mutation("/sign-in/email", { email, password });
    expect(signin.status).toBe(200);
    const change = await mutation(
      "/change-email",
      { newEmail },
      cookieFrom(signin),
    );
    expect(change.status).toBe(200);
    await expect(
      mailpit.waitForAndExercise({
        recipient: email,
        subject: `Confirm Quorum email change to ${newEmail}`,
        timeoutMs: 5_000,
        exercise: async (message) => {
          const link = new URL(message.text.trim());
          return link.origin === origin && link.searchParams.has("token");
        },
      }),
    ).resolves.toEqual({ delivered: true, exercised: true });
  });
});
