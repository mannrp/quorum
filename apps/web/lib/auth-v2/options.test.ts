// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { BetterAuthOptions } from "better-auth";
import { buildBetterAuthOptions } from "./options";

describe("Better Auth production options", () => {
  it("enforces the accepted cookie, password, session, linking, and database rate-limit policy", () => {
    const database = {} as NonNullable<BetterAuthOptions["database"]>;
    const send = vi.fn();
    const options = buildBetterAuthOptions({
      config: {
        baseURL: "https://quorum.example",
        databaseURL: "postgresql://unused",
        secret: "q".repeat(32),
        trustedOrigins: ["https://quorum.example"],
        cookie: { secure: true, httpOnly: true, sameSite: "lax" },
        password: { minLength: 29, maxLength: 128 },
        session: { idleSeconds: 86_400, absoluteSeconds: 604_800, recentAuthSeconds: 600 },
        databaseSchema: "better_auth",
        allowImplicitSameEmailLinking: false,
      },
      database,
      sendChangeEmailConfirmation: send,
      sendResetPassword: send,
      sendVerificationEmail: send,
    });

    expect(options.database).toBe(database);
    expect(options.trustedOrigins).toEqual(["https://quorum.example"]);
    expect(options.advanced).toMatchObject({
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: true },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      useSecureCookies: true,
    });
    expect(options.advanced?.defaultCookieAttributes).not.toHaveProperty("domain");
    expect(options.emailAndPassword).toMatchObject({
      enabled: true,
      minPasswordLength: 29,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
    });
    expect(options.session).toMatchObject({
      cookieCache: { enabled: false },
      expiresIn: 86_400,
      freshAge: 600,
    });
    expect(options.account?.accountLinking).toMatchObject({
      disableImplicitLinking: true,
      allowDifferentEmails: false,
      allowUnlinkingAll: false,
    });
    expect(options.rateLimit).toMatchObject({ enabled: true, storage: "database" });
  });
});
