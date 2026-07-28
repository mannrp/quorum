import { describe, expect, it, vi } from "vitest";

import { buildBetterAuthSpikeOptions } from "./better-auth-options";

describe("Better Auth 1.6.25 acceptance configuration", () => {
  it("uses the D-034 conservative UTF-16 threshold and maintained controls", () => {
    const rejectMail = vi.fn(async () => {
      throw new Error("test mail adapter");
    });
    const options = buildBetterAuthSpikeOptions({
      database: {} as never,
      baseURL: "http://127.0.0.1:3000/api/auth-v2-spike",
      secret: "s".repeat(32),
      sendChangeEmailConfirmation: rejectMail,
      sendResetPassword: rejectMail,
      sendVerificationEmail: rejectMail,
      trustedOrigins: ["http://127.0.0.1:3000"],
    });

    expect(options.emailAndPassword).toMatchObject({
      enabled: true,
      minPasswordLength: 29,
      maxPasswordLength: 256,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
    });
    expect(options.advanced).toMatchObject({
      disableCSRFCheck: false,
      disableOriginCheck: false,
      useSecureCookies: true,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      },
    });
    expect(options.rateLimit).toMatchObject({
      enabled: true,
      storage: "database",
    });
    expect(options.plugins).toHaveLength(2);
  });
});
