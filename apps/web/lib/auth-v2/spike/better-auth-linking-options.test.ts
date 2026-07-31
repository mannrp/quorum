import { describe, expect, it } from "vitest";

import { buildBetterAuthSpikeOptions } from "./better-auth-options";

describe("Better Auth explicit account-linking policy", () => {
  it("disables implicit same-email linking and preserves a usable method", () => {
    const rejectMail = async () => {
      throw new Error("test mail adapter");
    };
    const options = buildBetterAuthSpikeOptions({
      database: {} as never,
      baseURL: "http://127.0.0.1:3000/api/auth-v2-spike",
      secret: "s".repeat(32),
      sendChangeEmailConfirmation: rejectMail,
      sendResetPassword: rejectMail,
      sendVerificationEmail: rejectMail,
      trustedOrigins: ["http://127.0.0.1:3000"],
    });

    expect(options.account?.accountLinking).toEqual({
      allowDifferentEmails: false,
      allowUnlinkingAll: false,
      disableImplicitLinking: true,
      enabled: true,
      requireLocalEmailVerified: true,
      updateUserInfoOnLink: false,
    });
  });
});
